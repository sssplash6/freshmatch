import { useState, useEffect, useMemo, useCallback } from 'react'
import '../styles/Admin.css'

const TOKEN_KEY = 'fa-admin-token'

// Parse a SAT-style numeric score out of a free-text field ("1500", "N/A", "").
function num(v) {
  const n = parseInt(String(v ?? '').replace(/[^0-9.]/g, ''), 10)
  return Number.isFinite(n) ? n : null
}

// CSV with the same formula-injection guard the server uses.
function toCsv(rows, cols) {
  const esc = v => {
    if (v == null) return ''
    let s = Array.isArray(v) ? v.join('; ') : String(v)
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\r\n')
}

function download(name, text, type) {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name; a.click()
  URL.revokeObjectURL(url)
}

function Login({ onAuth }) {
  const [token, setToken] = useState('')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (!token.trim() || status === 'checking') return
    setStatus('checking'); setError('')
    try {
      const res = await fetch('/api/submissions?limit=1', { headers: { 'x-admin-token': token } })
      if (res.ok) { sessionStorage.setItem(TOKEN_KEY, token); onAuth(token); return }
      if (res.status === 401) setError('Wrong admin token.')
      else if (res.status === 404) setError('Admin access is not enabled (ADMIN_TOKEN unset on the server).')
      else if (res.status === 503) setError('No database configured on the server.')
      else setError(`Error ${res.status}`)
      setStatus('error')
    } catch {
      setError('Could not reach the server.'); setStatus('error')
    }
  }

  return (
    <div className="adm-login">
      <form className="adm-login-card" onSubmit={submit}>
        <div className="adm-brand">Freshman Academy</div>
        <h1 className="adm-login-title">Scouting dashboard</h1>
        <p className="adm-login-sub">Enter the admin token to view submissions.</p>
        <input
          className={`adm-login-input${status === 'error' ? ' adm-input--error' : ''}`}
          type="password" value={token} autoFocus autoComplete="off"
          onChange={e => { setToken(e.target.value); if (status === 'error') setStatus('idle') }}
          placeholder="Admin token" aria-label="Admin token"
        />
        {status === 'error' && <div className="adm-error">{error}</div>}
        <button type="submit" className={`adm-btn${token.trim() && status !== 'checking' ? ' active' : ''}`}>
          {status === 'checking' ? 'Checking…' : 'Sign in →'}
        </button>
      </form>
    </div>
  )
}

const EXPORT_COLS = ['created_at', 'name', 'email', 'country', 'grade', 'school_name', 'sat', 'gpa', 'majors', 'dream_schools', 'personality_type', 'consent_offers']

export default function Admin() {
  const [token, setToken]   = useState(() => sessionStorage.getItem(TOKEN_KEY) || '')
  const [rows, setRows]     = useState([])
  const [status, setStatus] = useState('idle') // idle | loading | done | error
  const [error, setError]   = useState('')

  // filters
  const [q, setQ]             = useState('')
  const [country, setCountry] = useState('')
  const [grade, setGrade]     = useState('')
  const [minSat, setMinSat]   = useState('')
  const [sort, setSort]       = useState('newest')
  const [selected, setSelected] = useState(() => new Set())

  const load = useCallback(async (tok) => {
    setStatus('loading'); setError('')
    try {
      const res = await fetch('/api/submissions?limit=5000', { headers: { 'x-admin-token': tok } })
      if (res.status === 401) { sessionStorage.removeItem(TOKEN_KEY); setToken(''); return }
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const data = await res.json()
      setRows(data.submissions || [])
      setStatus('done')
    } catch (err) { setError(err.message); setStatus('error') }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount
  useEffect(() => { if (token) load(token) }, [token, load])

  const countries = useMemo(
    () => [...new Set(rows.map(r => r.country).filter(Boolean))].sort(),
    [rows],
  )
  const grades = useMemo(
    () => [...new Set(rows.map(r => r.grade).filter(Boolean))].sort(),
    [rows],
  )

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const minS = num(minSat)
    let out = rows.filter(r => {
      if (country && r.country !== country) return false
      if (grade && r.grade !== grade) return false
      if (minS != null && (num(r.sat) ?? -1) < minS) return false
      if (needle) {
        const hay = `${r.name || ''} ${r.email || ''} ${r.school_name || ''} ${(r.majors || []).join(' ')}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
    out = [...out].sort((a, b) => {
      if (sort === 'sat')  return (num(b.sat) ?? -1) - (num(a.sat) ?? -1)
      if (sort === 'gpa')  return (num(b.gpa) ?? -1) - (num(a.gpa) ?? -1)
      if (sort === 'oldest') return String(a.created_at).localeCompare(String(b.created_at))
      return String(b.created_at).localeCompare(String(a.created_at)) // newest
    })
    return out
  }, [rows, q, country, grade, minSat, sort])

  // Acts on selected rows when any are ticked, otherwise the whole filtered set.
  const target = useMemo(
    () => (selected.size ? filtered.filter(r => selected.has(r.id)) : filtered),
    [filtered, selected],
  )
  const emails = useMemo(
    () => [...new Set(target.map(r => (r.email || '').trim()).filter(Boolean))],
    [target],
  )

  const [copied, setCopied] = useState(false)
  function copyEmails() {
    if (!emails.length) return
    navigator.clipboard.writeText(emails.join(', ')).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1600)
    })
  }
  function exportCsv() {
    download('submissions.csv', toCsv(target, EXPORT_COLS), 'text/csv')
  }
  function signOut() { sessionStorage.removeItem(TOKEN_KEY); setToken('') }

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const allShownSelected = filtered.length > 0 && filtered.every(r => selected.has(r.id))
  function toggleAll() {
    setSelected(prev => {
      if (allShownSelected) {
        const next = new Set(prev)
        filtered.forEach(r => next.delete(r.id))
        return next
      }
      return new Set([...prev, ...filtered.map(r => r.id)])
    })
  }

  if (!token) return <Login onAuth={setToken} />

  return (
    <div className="adm">
      <header className="adm-head">
        <div>
          <div className="adm-brand">Freshman Academy</div>
          <h1 className="adm-title">Scouting dashboard</h1>
        </div>
        <div className="adm-head-actions">
          <button className="adm-ghost" onClick={() => load(token)} disabled={status === 'loading'}>
            {status === 'loading' ? 'Loading…' : '↻ Refresh'}
          </button>
          <button className="adm-ghost" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <div className="adm-toolbar">
        <input className="adm-search" placeholder="Search name, email, school, major…" value={q} onChange={e => setQ(e.target.value)} />
        <select value={country} onChange={e => setCountry(e.target.value)}>
          <option value="">All countries</option>
          {countries.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={grade} onChange={e => setGrade(e.target.value)}>
          <option value="">All grades</option>
          {grades.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <input className="adm-minsat" type="number" placeholder="Min SAT" value={minSat} onChange={e => setMinSat(e.target.value)} />
        <select value={sort} onChange={e => setSort(e.target.value)}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="sat">Highest SAT</option>
          <option value="gpa">Highest GPA</option>
        </select>
      </div>

      <div className="adm-bar">
        <span className="adm-count">
          {filtered.length} of {rows.length} applicants
          {selected.size > 0 && ` · ${selected.size} selected`}
        </span>
        <div className="adm-bar-actions">
          <button className="adm-action" onClick={copyEmails} disabled={!emails.length}>
            {copied ? '✓ Copied' : `Copy ${emails.length} email${emails.length === 1 ? '' : 's'}`}
          </button>
          <button className="adm-action" onClick={exportCsv} disabled={!target.length}>Export CSV</button>
        </div>
      </div>

      {status === 'error' && <div className="adm-error adm-error--block">{error}</div>}

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th className="adm-check"><input type="checkbox" checked={allShownSelected} onChange={toggleAll} aria-label="Select all" /></th>
              <th>Date</th><th>Name</th><th>Email</th><th>Country</th><th>Grade</th>
              <th>School</th><th>SAT</th><th>GPA</th><th>Majors</th><th>Dream schools</th><th>Type</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} className={selected.has(r.id) ? 'adm-row--on' : ''}>
                <td className="adm-check"><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${r.name || r.id}`} /></td>
                <td className="adm-nowrap">{String(r.created_at || '').slice(0, 10)}</td>
                <td>{r.name || '—'}</td>
                <td>{r.email ? <a href={`mailto:${r.email}`}>{r.email}</a> : '—'}</td>
                <td>{r.country || '—'}</td>
                <td>{r.grade || '—'}</td>
                <td>{r.school_name || '—'}</td>
                <td>{r.sat || '—'}</td>
                <td>{r.gpa || '—'}</td>
                <td className="adm-wrap">{(r.majors || []).join(', ') || '—'}</td>
                <td className="adm-wrap">{(r.dream_schools || []).join(', ') || '—'}</td>
                <td>{r.personality_type || '—'}</td>
              </tr>
            ))}
            {status === 'done' && filtered.length === 0 && (
              <tr><td colSpan="12" className="adm-empty">No applicants match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
