// Email verification endpoints, mounted at /api/verify.
//   POST /send  { email }         → emails a 6-digit code
//   POST /check { email, code }   → on success returns a signed verifyToken
//
// The token is what gates /api/narrate; this route just mints it. Per-email
// throttling lives in verify.js; the per-IP cap is applied in index.js.
import { Router } from 'express'
import { requestCode, verifyCode, validEmail } from '../verify.js'

const router = Router()

router.post('/send', async (req, res) => {
  const { email } = req.body || {}
  if (!validEmail(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' })
  }
  try {
    const r = await requestCode(email)
    if (!r.ok) {
      if (r.retryAfter) res.setHeader('Retry-After', r.retryAfter)
      return res.status(429).json({ error: r.error, retryAfter: r.retryAfter })
    }
    return res.json({ sent: true })
  } catch (err) {
    console.error('[verify] send failed:', err.message)
    return res.status(502).json({ error: "We couldn't send your code right now. Please try again in a moment." })
  }
})

router.post('/check', (req, res) => {
  const { email, code } = req.body || {}
  if (!validEmail(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' })
  }
  if (!/^\d{4,8}$/.test(String(code || '').trim())) {
    return res.status(400).json({ error: 'Enter the 6-digit code from your email.' })
  }
  const r = verifyCode(email, code)
  if (!r.ok) return res.status(400).json({ error: r.error })
  return res.json({ verified: true, verifyToken: r.token })
})

export default router
