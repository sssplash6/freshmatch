import { useEffect, useState } from 'react'
import { ResultsView } from './Results'

// Read-only view of a results page someone shared via /r/:token. Fetches the
// display-safe payload (first name + matches) from the public endpoint and
// renders the exact same ResultsView the live quiz uses — closing the growth
// loop with a "take the quiz yourself" CTA instead of Start Over.
export default function SharedResults({ token }) {
  const [status, setStatus] = useState('loading') // 'loading' | 'done' | 'notfound'
  const [data, setData]     = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/r/${encodeURIComponent(token)}`)
        if (!res.ok) { if (!cancelled) setStatus('notfound'); return }
        const json = await res.json()
        if (cancelled) return
        setData(json)
        setStatus('done')
      } catch {
        if (!cancelled) setStatus('notfound')
      }
    }
    load()
    return () => { cancelled = true }
  }, [token])

  // Reflect whose results these are in the tab title.
  useEffect(() => {
    if (status === 'done' && data?.name) {
      document.title = `${data.name}'s college matches · FreshMatch`
    }
    return () => { document.title = 'FreshMatch' }
  }, [status, data])

  if (status === 'loading') {
    return (
      <div className="results-page">
        <div className="results-above-fold">
          <div className="results-header">
            <div className="results-eyebrow res-rise" style={{ animationDelay: '60ms' }}>FreshMatch</div>
            <div className="results-title res-rise" style={{ animationDelay: '110ms' }}>Loading these results…</div>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'notfound') {
    return (
      <div className="results-page">
        <div className="results-above-fold">
          <div className="results-header">
            <div className="results-eyebrow res-rise" style={{ animationDelay: '60ms' }}>FreshMatch</div>
            <div className="results-title res-rise" style={{ animationDelay: '110ms' }}>This results link isn't available</div>
            <p className="results-desc res-rise" style={{ animationDelay: '170ms' }}>
              The link may be incorrect or the results are no longer shared. You can run the calculator for yourself in about 5 minutes.
            </p>
          </div>
        </div>
        <div className="results-divider res-rise" style={{ animationDelay: '200ms' }} />
        <div className="results-actions res-rise" style={{ animationDelay: '240ms' }}>
          <a className="share-btn" href="/">Find where you fit →</a>
        </div>
      </div>
    )
  }

  const { name, output } = data
  return (
    <ResultsView
      name={name}
      personalityType={output?.personalityType}
      schools={output?.schools || []}
      dreamResults={output?.dreamSchools || []}
      recommendation={output?.recommendation}
      actions={
        <>
          <div className="shared-cta-line">Want to see where <strong>you</strong> actually fit?</div>
          <a className="share-btn" href="/">Take the quiz yourself →</a>
        </>
      }
    />
  )
}
