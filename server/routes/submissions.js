// Read-only access to collected submissions, guarded by ADMIN_TOKEN.
// The endpoint is disabled unless ADMIN_TOKEN is set, so it can never leak data
// by default. Pass the token as ?token= or an `x-admin-token` header.
//   GET /api/submissions?token=XXX&limit=100          → JSON rows
//   GET /api/submissions?token=XXX&format=csv         → CSV download
import { Router } from 'express'
import { dbEnabled, listSubmissions } from '../db.js'

const router = Router()

const COLS = ['id', 'created_at', 'name', 'email', 'country', 'school_name', 'grade', 'sat', 'gpa', 'efc', 'majors', 'dream_schools', 'personality_type', 'result_count']

function toCsv(rows) {
  const esc = v => {
    if (v == null) return ''
    const s = Array.isArray(v) ? v.join('; ') : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = COLS.join(',')
  const lines = rows.map(r => COLS.map(c => esc(r[c])).join(','))
  return [header, ...lines].join('\n')
}

router.get('/', async (req, res) => {
  const token = process.env.ADMIN_TOKEN
  if (!token) return res.status(404).json({ error: 'Not found' })

  const provided = req.query.token || req.get('x-admin-token')
  if (provided !== token) return res.status(401).json({ error: 'Unauthorized' })

  if (!dbEnabled()) return res.status(503).json({ error: 'No database configured' })

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
