// Read-only access to collected submissions, guarded by ADMIN_TOKEN.
// The endpoint is disabled unless ADMIN_TOKEN is set, so it can never leak data
// by default. Authenticate with an `x-admin-token` header (preferred — keeps the
// secret out of URLs/logs); a ?token= query param is also accepted for ad-hoc
// browser downloads, at the cost of the token appearing in access logs/history.
//   GET /api/submissions?limit=100   (x-admin-token: XXX)  → JSON rows
//   GET /api/submissions?format=csv  (x-admin-token: XXX)  → CSV download
import { Router } from 'express'
import { timingSafeEqual } from 'crypto'
import { dbEnabled, listSubmissions, getSubmission } from '../db.js'

const router = Router()

const COLS = ['id', 'created_at', 'name', 'email', 'country', 'school_name', 'grade', 'sat', 'gpa', 'efc', 'majors', 'dream_schools', 'personality_type', 'result_count', 'consent_data', 'consent_offers']

function toCsv(rows) {
  const esc = v => {
    if (v == null) return ''
    let s = Array.isArray(v) ? v.join('; ') : String(v)
    // Formula-injection guard: a leading =, +, -, @, tab, or CR makes spreadsheet
    // apps evaluate the cell. Prefix with a single quote to neutralize it.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = COLS.join(',')
  const lines = rows.map(r => COLS.map(c => esc(r[c])).join(','))
  return [header, ...lines].join('\r\n')
}

// Constant-time token check — avoids leaking the secret via response timing.
function tokenMatches(provided, token) {
  if (typeof provided !== 'string') return false
  const a = Buffer.from(provided)
  const b = Buffer.from(token)
  return a.length === b.length && timingSafeEqual(a, b)
}

// Shared guard for every admin route: hide existence when disabled (404),
// reject bad tokens (401), and surface a missing database (503).
router.use((req, res, next) => {
  const token = process.env.ADMIN_TOKEN
  if (!token) return res.status(404).json({ error: 'Not found' })

  const provided = req.get('x-admin-token') ?? req.query.token
  if (!tokenMatches(provided, token)) return res.status(401).json({ error: 'Unauthorized' })

  if (!dbEnabled()) return res.status(503).json({ error: 'No database configured' })
  next()
})

// Full single submission (extracurriculars, honors, essay, all answers).
router.get('/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id < 1) return res.status(404).json({ error: 'Not found' })
  try {
    const sub = getSubmission(id)
    if (!sub) return res.status(404).json({ error: 'Not found' })
    res.json(sub)
  } catch (err) {
    console.error('[submissions] detail query failed:', err.message)
    res.status(500).json({ error: err.message })
  }
})

router.get('/', async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 100, 1), 5000)
  try {
    // Lightweight columns for listing; full input/output stay in the table.
    const rows = listSubmissions(limit)
    if (req.query.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', 'attachment; filename="submissions.csv"')
      return res.send(toCsv(rows))
    }
    res.json({ count: rows.length, submissions: rows })
  } catch (err) {
    console.error('[submissions] query failed:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
