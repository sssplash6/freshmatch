// Public, read-only access to a single shared results page.
//   GET /api/r/:token  → { name, output: { personalityType, recommendation, schools, dreamSchools } }
//
// No authentication: a share link is meant to be opened by anyone the student
// sends it to. Safety comes from the token being unguessable (random, not the
// row id) and from getSubmissionByToken returning only display-safe fields —
// never email, scores, essay, or any other PII.
import { Router } from 'express'
import { getSubmissionByToken } from '../db.js'

const router = Router()

router.get('/:token', (req, res) => {
  const { token } = req.params
  // Cheap shape check before touching the DB — tokens are short url-safe strings.
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(token)) {
    return res.status(404).json({ error: 'Not found' })
  }
  try {
    const shared = getSubmissionByToken(token)
    if (!shared) return res.status(404).json({ error: 'Not found' })
    res.json(shared)
  } catch (err) {
    console.error('[share] lookup failed:', err.message)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
