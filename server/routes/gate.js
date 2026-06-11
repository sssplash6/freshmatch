import { Router } from 'express'
import { timingSafeEqual } from 'crypto'

const router = Router()

// POST /api/gate — verify the access code against ACCESS_TOKEN.
// When ACCESS_TOKEN is unset the gate is disabled and everyone passes, so
// local dev and unconfigured environments aren't locked out.
router.post('/', (req, res) => {
  const expected = process.env.ACCESS_TOKEN
  if (!expected) return res.json({ ok: true })

  const provided = typeof req.body?.token === 'string' ? req.body.token.trim() : ''
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  const ok = a.length === b.length && timingSafeEqual(a, b)

  if (!ok) return res.status(401).json({ error: 'Invalid access code' })
  return res.json({ ok: true })
})

export default router
