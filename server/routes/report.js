// Per-College Report API.
//
//   POST /api/report              { collegeId, fitScore?, verifyToken, email, …profile }
//   GET  /api/report/:key.pdf     the rendered document (immutable, ETag'd)
//   GET  /api/report/:key.json    gap vector + plan — the partner-shaped payload
//   POST /api/reports/batch       { colleges: [{id, fitScore?}] | collegeIds, … }
//
// Idempotency: reportKey = sha256(profile + collegeId + fitScore + engine
// version). The key is the filename — a repeat request is a disk read, zero
// tokens. Bumping ENGINE_VERSION invalidates every cached report cleanly.
//
// Reports live on the persistent disk next to the SQLite file by default
// (REPORTS_DIR overrides), as <key>.pdf plus a <key>.json sidecar so the JSON
// endpoint works with or without a database. A size-capped LRU sweep keeps the
// disk bounded.
import { Router } from 'express'
import { createHash } from 'crypto'
import { existsSync, mkdirSync } from 'fs'
import { readFile, writeFile, rename, readdir, stat, unlink } from 'fs/promises'
import { dirname, join } from 'path'
import { tmpdir } from 'os'
import { verifyToken } from '../verify.js'
import { saveReport } from '../db.js'
import { rateLimit } from '../rateLimit.js'
import { loadData } from '../data.js'
import { hasAssessableSignal } from '../scoring.js'
import { resolveCollege } from '../report/college.js'
import { generateReport } from '../report/generate.js'
import { renderReportPdf } from '../report/pdf.js'
import { ENGINE_VERSION } from '../report/version.js'

// ── storage ──────────────────────────────────────────────────────────────────

const REPORTS_DIR = process.env.REPORTS_DIR
  || (process.env.DATABASE_PATH ? join(dirname(process.env.DATABASE_PATH), 'reports') : join(tmpdir(), 'freshmatch-reports'))
const MAX_DISK_BYTES = parseInt(process.env.REPORTS_MAX_BYTES) || 500_000_000

let dirReady = false
function ensureDir() {
  if (!dirReady) {
    mkdirSync(REPORTS_DIR, { recursive: true })
    dirReady = true
  }
}

const pdfPath = key => join(REPORTS_DIR, `${key}.pdf`)
const jsonPath = key => join(REPORTS_DIR, `${key}.json`)

// Write via tmp+rename so a crashed write can never serve a half-file.
async function writeAtomic(path, data) {
  const tmp = `${path}.tmp-${process.pid}`
  await writeFile(tmp, data)
  await rename(tmp, path)
}

// Size-capped LRU: when the directory outgrows the cap, drop oldest-modified
// files until back under. Runs after each write, never blocks the response,
// and any error is logged and swallowed — eviction is hygiene, not correctness.
let sweeping = false
async function sweepDisk() {
  if (sweeping) return
  sweeping = true
  try {
    const names = await readdir(REPORTS_DIR)
    const files = []
    for (const name of names) {
      try {
        const st = await stat(join(REPORTS_DIR, name))
        if (st.isFile()) files.push({ name, size: st.size, mtime: st.mtimeMs })
      } catch { /* raced a delete */ }
    }
    let total = files.reduce((s, f) => s + f.size, 0)
    if (total <= MAX_DISK_BYTES) return
    files.sort((a, b) => a.mtime - b.mtime)
    for (const f of files) {
      if (total <= MAX_DISK_BYTES) break
      try { await unlink(join(REPORTS_DIR, f.name)); total -= f.size } catch { /* raced */ }
    }
  } catch (err) {
    console.error('[report] disk sweep failed:', err.message)
  } finally {
    sweeping = false
  }
}

// ── idempotency key ──────────────────────────────────────────────────────────

// Only the fields that shape report content participate in the key.
const KEY_FIELDS = ['name', 'country', 'grade', 'testScores', 'extracurriculars', 'honors', 'essay', 'majors', 'efc']

// Canonical JSON: object keys sorted recursively so client-side key order can
// never split the cache.
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

export function reportKeyFor(profile, collegeId, fitScore) {
  const picked = Object.fromEntries(KEY_FIELDS.map(f => [f, profile[f] ?? null]))
  return createHash('sha256')
    .update(`${canonical(picked)}|${collegeId}|${fitScore ?? ''}|${ENGINE_VERSION}`)
    .digest('hex')
}

// ── weighted per-IP rate limit ───────────────────────────────────────────────
// Report generation costs one LLM call per college, so the unit is a college,
// not a request: a batch of 8 consumes 8. Cached reports consume nothing.

const LIMIT_WINDOW_MS = 30 * 60 * 1000
const LIMIT_MAX = 12
const hits = new Map()
const sweepHits = setInterval(() => {
  const now = Date.now()
  for (const [ip, rec] of hits) if (rec.resetAt <= now) hits.delete(ip)
}, LIMIT_WINDOW_MS)
sweepHits.unref?.()

function consumeQuota(ip, n) {
  const now = Date.now()
  let rec = hits.get(ip)
  if (!rec || rec.resetAt <= now) {
    rec = { count: 0, resetAt: now + LIMIT_WINDOW_MS }
    hits.set(ip, rec)
  }
  if (rec.count + n > LIMIT_MAX) {
    return { allowed: false, retryAfter: Math.ceil((rec.resetAt - now) / 1000) }
  }
  rec.count += n
  return { allowed: true }
}

// ── generation core (shared by single + batch) ───────────────────────────────

// Concurrent identical requests share one generation, same pattern as narrate.
const inflight = new Map()

const clampFit = v => (Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v))) : null)

async function readCached(key) {
  try {
    const raw = await readFile(jsonPath(key), 'utf8')
    if (!existsSync(pdfPath(key))) return null      // sidecar without pdf → regenerate
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// Returns the response payload for one (profile, college) pair, generating and
// persisting on cache miss. `chargeQuota` is called only when real generation
// (an LLM call) is about to happen — cached reports are free.
async function getOrGenerate(profile, collegeId, fitScore, email, chargeQuota) {
  const key = reportKeyFor(profile, collegeId, fitScore)

  const cached = await readCached(key)
  if (cached) return { ...cached, cached: true }

  if (inflight.has(key)) return { ...(await inflight.get(key)), cached: true }

  const quota = chargeQuota()
  if (!quota.allowed) {
    const err = new Error('Report limit reached. Please wait a while and try again.')
    err.status = 429
    err.retryAfter = quota.retryAfter
    throw err
  }

  const work = (async () => {
    const report = await generateReport(profile, collegeId, { fitScore })
    const pdf = await renderReportPdf(report)

    const payload = {
      reportId: key,
      pdfUrl: `/api/report/${key}.pdf`,
      engineVersion: report.engineVersion,
      generatedAt: report.generatedAt,
      college: report.college,
      gapVector: report.gapVector,
      plan: report.plan,
      proseSource: report.proseSource,
    }

    ensureDir()
    await writeAtomic(pdfPath(key), pdf)
    await writeAtomic(jsonPath(key), JSON.stringify(payload))
    sweepDisk().catch(() => {})

    saveReport({
      reportKey: key,
      collegeId,
      engineVersion: report.engineVersion,
      email,
      chanceBefore: report.gapVector.chance,
      chanceCeiling: report.plan.scenarios.maximum.chance,
      improvementCount: report.plan.actions.length,
      proseSource: report.proseSource,
      pdfBytes: pdf.length,
    })

    return payload
  })()

  inflight.set(key, work)
  try {
    return { ...(await work), cached: false }
  } finally {
    inflight.delete(key)
  }
}

// Shared request vetting for the single and batch endpoints. Returns
// { profile, email } or writes the error response and returns null.
async function vetRequest(req, res) {
  const profile = req.body.profile && typeof req.body.profile === 'object' ? req.body.profile : req.body
  const email = req.body.email

  if (req.body.consentData !== true) {
    res.status(400).json({ error: 'Consent is required to generate a report.' })
    return null
  }
  if (!verifyToken(req.body.verifyToken, email)) {
    res.status(401).json({ error: 'Please verify your email to generate reports.', needVerification: true })
    return null
  }
  if (!Number.isFinite(profile.efc)) {
    res.status(400).json({ error: 'EFC is required.' })
    return null
  }
  if (!hasAssessableSignal(profile)) {
    res.status(422).json({ error: "There isn't enough real information in this profile to build a report from.", insufficient: true })
    return null
  }
  return { profile, email }
}

const router = Router()

// ── POST /api/report — one college ───────────────────────────────────────────

router.post('/report', async (req, res) => {
  try {
    const vetted = await vetRequest(req, res)
    if (!vetted) return
    const { profile, email } = vetted

    const collegeId = String(req.body.collegeId || '')
    const data = await loadData()
    if (!collegeId || !resolveCollege(collegeId, data)) {
      return res.status(404).json({ error: 'Unknown college.' })
    }

    const payload = await getOrGenerate(
      profile, collegeId, clampFit(req.body.fitScore), email,
      () => consumeQuota(req.ip || 'unknown', 1),
    )
    res.json(payload)
  } catch (err) {
    if (err.status === 429) {
      res.setHeader('Retry-After', err.retryAfter)
      return res.status(429).json({ error: err.message })
    }
    console.error('/api/report error:', err.message)
    res.status(500).json({ error: 'Could not generate the report right now. Please try again.' })
  }
})

// ── POST /api/reports/batch — counselor fan-out, concurrency 4 ──────────────

const BATCH_MAX = 12
const BATCH_CONCURRENCY = 4

router.post('/reports/batch', async (req, res) => {
  try {
    const vetted = await vetRequest(req, res)
    if (!vetted) return
    const { profile, email } = vetted

    const wanted = Array.isArray(req.body.colleges)
      ? req.body.colleges.map(c => ({ id: String(c?.id || ''), fitScore: clampFit(c?.fitScore) }))
      : Array.isArray(req.body.collegeIds)
        ? req.body.collegeIds.map(id => ({ id: String(id || ''), fitScore: null }))
        : []
    const seen = new Set()
    const colleges = wanted.filter(c => c.id && !seen.has(c.id) && seen.add(c.id))
    if (!colleges.length || colleges.length > BATCH_MAX) {
      return res.status(400).json({ error: `Provide 1–${BATCH_MAX} colleges.` })
    }

    const data = await loadData()
    const ip = req.ip || 'unknown'
    // One shared quota charge, sized by how many colleges actually need a
    // fresh generation — checked per college at generation time so cached
    // entries stay free.
    const results = []
    let index = 0
    async function worker() {
      while (index < colleges.length) {
        const { id, fitScore } = colleges[index++]
        if (!resolveCollege(id, data)) {
          results.push({ collegeId: id, status: 'error', error: 'Unknown college.' })
          continue
        }
        try {
          const payload = await getOrGenerate(profile, id, fitScore, email, () => consumeQuota(ip, 1))
          results.push({ collegeId: id, status: 'ok', reportId: payload.reportId, pdfUrl: payload.pdfUrl, cached: payload.cached })
        } catch (err) {
          results.push({
            collegeId: id, status: 'error',
            error: err.status === 429 ? 'Report limit reached for now.' : 'Generation failed.',
          })
          if (err.status !== 429) console.error(`/api/reports/batch ${id}:`, err.message)
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(BATCH_CONCURRENCY, colleges.length) }, worker))

    // Preserve request order — partial success is per college, never fatal.
    const byId = new Map(results.map(r => [r.collegeId, r]))
    res.json({ reports: colleges.map(c => byId.get(c.id)) })
  } catch (err) {
    console.error('/api/reports/batch error:', err.message)
    res.status(500).json({ error: 'Could not generate reports right now. Please try again.' })
  }
})

// ── GET endpoints — unguessable 64-hex key is the access control ────────────
// (The key derives from the full profile; holding it means you held the
// profile. Same protection class as the share-token pages.)

const KEY_RE = /^[a-f0-9]{64}$/

// Reads are cheap disk hits, but uncapped reads invite scraping — same posture
// as the share pages: ample for a person, pointless for bulk key-guessing.
const readLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 120 })

router.get('/report/:key.pdf', readLimiter, async (req, res) => {
  const { key } = req.params
  if (!KEY_RE.test(key) || !existsSync(pdfPath(key))) {
    return res.status(404).json({ error: 'Report not found.' })
  }
  if (req.headers['if-none-match'] === `"${key}"`) return res.status(304).end()
  res.setHeader('ETag', `"${key}"`)
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable')
  res.setHeader('Content-Disposition', 'inline; filename="freshmatch-report.pdf"')
  res.type('application/pdf')
  res.sendFile(pdfPath(key))
})

router.get('/report/:key.json', readLimiter, async (req, res) => {
  const { key } = req.params
  if (!KEY_RE.test(key)) return res.status(404).json({ error: 'Report not found.' })
  const payload = await readCached(key)
  if (!payload) return res.status(404).json({ error: 'Report not found.' })
  res.setHeader('ETag', `"${key}"`)
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable')
  res.json(payload)
})

export default router
