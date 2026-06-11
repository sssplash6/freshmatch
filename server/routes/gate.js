import { Router } from 'express'
import { timingSafeEqual } from 'crypto'

const router = Router()

// Timing-safe string equality. Length mismatch short-circuits, but the
// underlying compare is constant-time for equal-length inputs.
function safeEqual(a, b) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

// POST /api/gate — verify the access code against ACCESS_TOKEN, which holds a
// comma-separated list of valid codes (any one passes). Hand out different
// codes to different people; remove one from the list to revoke just it.
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
  const ok = codes.reduce((hit, code) => safeEqual(provided, code) || hit, false)

  if (!ok) return res.status(401).json({ error: 'Invalid access code' })
  return res.json({ ok: true })
})

export default router
