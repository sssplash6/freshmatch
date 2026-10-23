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
  const names = stats?.countryNames ?? []

  return (
    <div className="results-page">
      <div className="results-header">
        <div className="results-eyebrow">FreshMatch · live</div>
        {names.length > 0 ? (
          <h1 className="results-title">
            Used by students in <CountryCarousel names={names} />
          </h1>
        ) : (
          <h1 className="results-title">Students using FreshMatch</h1>
        )}
        <p className="results-desc">
          {since ? `Every assessment since ${since}, ` : 'Every assessment, '}
          counted straight from the production database.
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

          <p className="stats-updated">
            {failed ? 'Could not refresh, showing the last numbers.' : `Updated ${updated.toLocaleTimeString('en-GB')}`}
          </p>
        </>
      )}

      <div className="results-divider" />
      <div className="results-actions">
        <a className="share-btn" href="/">Try now →</a>
      </div>
    </div>
  )
}

// One country at a time, most assessments first. Screen readers get the whole
// list once instead of a name that changes every two seconds.
function CountryCarousel({ names }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (names.length < 2) return
    const timer = setInterval(() => setI(n => n + 1), 2200)
    return () => clearInterval(timer)
  }, [names.length])
  return (
    <>
      {/* key remounts the span so its entry animation replays on every change */}
      <span className="stats-country" key={i} aria-hidden="true">{names[i % names.length]}</span>
      <span className="sr-only">{names.join(', ')}</span>
    </>
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
