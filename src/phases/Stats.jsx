import { useEffect, useState } from 'react'
import '../styles/Results.css'
import '../styles/Stats.css'

// Public live totals at /stats, read from /api/stats (aggregates only) and
// refreshed on an interval so the page stays live while it is open.
const REFRESH_MS = 30_000

const fmt = n => (n ?? 0).toLocaleString('en-US')
const sqlDate = s => new Date(s.replace(' ', 'T') + 'Z')

export default function Stats() {
  const [stats, setStats] = useState(null)
  const [updated, setUpdated] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    document.title = 'Live numbers · FreshMatch'
    let alive = true
    const load = () =>
      fetch('/api/stats')
        .then(res => (res.ok ? res.json() : Promise.reject(res.status)))
        .then(s => { if (alive) { setStats(s); setUpdated(new Date()); setFailed(false) } })
        .catch(() => { if (alive) setFailed(true) })
    load()
    const timer = setInterval(load, REFRESH_MS)
    return () => { alive = false; clearInterval(timer); document.title = 'FreshMatch' }
  }, [])

  const since = stats?.since
    ? sqlDate(stats.since).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null
  const top = stats?.topCountries ?? []
  const max = top[0]?.n || 1
  const otherCountries = Math.max(0, (stats?.countries ?? 0) - top.length)

  return (
    <div className="results-page">
      <div className="results-header">
        <div className="results-eyebrow">FreshMatch · live</div>
        <h1 className="results-title">Students using FreshMatch</h1>
        <p className="results-desc">
          {since ? `Every assessment since ${since}, ` : 'Every assessment, '}
          counted straight from the production database. Counts only: no names, emails or schools.
        </p>
      </div>

      {!stats && (
        <p className="results-desc">{failed ? 'The numbers are unavailable right now.' : 'Loading…'}</p>
      )}

      {stats && (
        <>
          <div className="stats-tiles">
            <Tile n={stats.assessments} label="assessments" />
            <Tile n={stats.students} label="students" />
            <Tile n={stats.countries} label="countries" />
            <Tile n={stats.returners} label="came back to run it again" />
            <Tile n={stats.reports} label="per-college PDF reports" />
            <Tile n={stats.lastWeek} label="assessments in the last 7 days" />
          </div>

          <h2 className="stats-heading">Assessments by country</h2>
          <ul className="stats-bars">
            {top.map(c => (
              <li key={c.country}>
                <span className="stats-bar-label">{c.country}</span>
                <span className="stats-bar-track">
                  <span className="stats-bar-fill" style={{ width: `${(c.n / max) * 100}%` }} />
                </span>
                <span className="stats-bar-n">{fmt(c.n)}</span>
              </li>
            ))}
          </ul>
          {otherCountries > 0 && (
            <p className="results-desc">and {otherCountries} more {otherCountries === 1 ? 'country' : 'countries'}</p>
          )}

          <p className="stats-updated">
            {failed ? 'Could not refresh, showing the last numbers.' : `Updated ${updated.toLocaleTimeString('en-GB')}`}
          </p>
        </>
      )}

      <div className="results-divider" />
      <div className="results-actions">
        <a className="share-btn" href="/">Find where you fit →</a>
      </div>
    </div>
  )
}

function Tile({ n, label }) {
  return (
    <div className="stats-tile">
      <div className="stats-tile-n">{fmt(n)}</div>
      <div className="stats-tile-label">{label}</div>
    </div>
  )
}
