import { Router } from 'express'
import { timingSafeEqual } from 'crypto'
import { redeemCode } from '../db.js'

const router = Router()

// Timing-safe string equality. Length mismatch short-circuits, but the
// underlying compare is constant-time for equal-length inputs.
function safeEqual(a, b) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

// POST /api/gate — verify a single-use access code against ACCESS_TOKEN, which
// holds a comma-separated list of valid codes. A code is valid only on its
// first use: once redeemed it is recorded in the database and rejected after.
// When ACCESS_TOKEN is unset the gate is disabled and everyone passes, so
// local dev and unconfigured environments aren't locked out.
router.post('/', (req, res) => {
  const codes = (process.env.ACCESS_TOKEN || '')
    .split(',')
    .map(c => c.trim())
    .filter(Boolean)
  if (codes.length === 0) return res.json({ ok: true })

  const provided = typeof req.body?.token === 'string' ? req.body.token.trim() : ''
  // Check every code (no early return) so timing doesn't reveal list position.
  const valid = codes.reduce((hit, code) => safeEqual(provided, code) || hit, false)
  if (!valid) return res.status(401).json({ error: 'Invalid access code' })

  // Code is in the list — try to spend it. redeemCode is atomic.
  const redeemed = redeemCode(provided)
  if (redeemed === false) {
    return res.status(409).json({ error: 'This code has already been used' })
  }
  // redeemed === true (first use) or null (no DB → can't enforce single-use).
  return res.json({ ok: true })
})

export default router
