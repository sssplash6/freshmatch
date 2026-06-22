// Tiny dependency-free per-IP rate limiter (fixed window).
//
// Scoped to the expensive /api/narrate endpoint: each OpenRouter call costs real
// money and writes a DB row, so we cap how often a single client can trigger one.
// A per-IP cap (rather than a global ceiling) bounds any one abuser without ever
// locking out the wider user base if the day gets busy.
//
// In-memory only — fine for the single Node process on Render; counters reset on
// restart. For correct client IPs behind Render's proxy, the app must
// `app.set('trust proxy', 1)` so req.ip reads X-Forwarded-For.
export function rateLimit({ windowMs, max, message = 'Too many requests. Please wait a moment and try again.' }) {
  const hits = new Map() // ip -> { count, resetAt }

  // Drop stale windows so the map can't grow unbounded.
  const sweep = setInterval(() => {
    const now = Date.now()
    for (const [ip, rec] of hits) if (rec.resetAt <= now) hits.delete(ip)
  }, windowMs)
  sweep.unref?.()  // don't keep the process alive just for cleanup

  return (req, res, next) => {
    const now = Date.now()
    const ip = req.ip || req.socket?.remoteAddress || 'unknown'

    let rec = hits.get(ip)
    if (!rec || rec.resetAt <= now) {
      rec = { count: 0, resetAt: now + windowMs }
      hits.set(ip, rec)
    }
    rec.count++

    res.setHeader('X-RateLimit-Limit', max)
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - rec.count))

    if (rec.count > max) {
      res.setHeader('Retry-After', Math.ceil((rec.resetAt - now) / 1000))
      return res.status(429).json({ error: message })
    }
    next()
  }
}
