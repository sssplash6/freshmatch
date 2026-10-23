// Submission persistence — SQLite on a Render persistent disk.
//
// Storage location is DATABASE_PATH (e.g. /var/data/submissions.sqlite on the
// mounted disk). Design goals:
// - If DATABASE_PATH is unset (e.g. local dev), every call is a silent no-op so
//   the app runs identically without a database.
// - A database error NEVER breaks the user's request — saves are wrapped and
//   failures are logged, not thrown.
import Database from 'better-sqlite3'
import { mkdirSync } from 'fs'
import { dirname } from 'path'
import { randomBytes } from 'crypto'
import { COUNTRIES } from '../src/data/countries.js'

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS submissions (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    name             TEXT,
    email            TEXT,
    country          TEXT,
    school_name      TEXT,
    grade            TEXT,
    sat              TEXT,
    gpa              TEXT,
    efc              INTEGER,
    majors           TEXT,         -- JSON array
    dream_schools    TEXT,         -- JSON array of ids
    personality_type TEXT,
    result_count     INTEGER,
    consent_data     INTEGER,       -- required consent (1/0)
    consent_offers   INTEGER,       -- optional marketing consent (1/0)
    share_token      TEXT,          -- unguessable public id for the shareable results page
    input            TEXT NOT NULL, -- full request body, JSON
    output           TEXT NOT NULL  -- full response payload, JSON
  );
  CREATE INDEX IF NOT EXISTS submissions_created_at_idx ON submissions (created_at DESC);
  CREATE INDEX IF NOT EXISTS submissions_email_idx ON submissions (email);

  -- Per-College Report generations. The PDF + JSON payload live on disk keyed
  -- by report_key (sha256 of profile + college + engine version — also the
  -- idempotency cache key); this table is the analytics/admin trail.
  CREATE TABLE IF NOT EXISTS reports (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    report_key        TEXT NOT NULL UNIQUE,
    college_id        TEXT NOT NULL,
    engine_version    TEXT NOT NULL,
    email             TEXT,
    chance_before     INTEGER,
    chance_ceiling    INTEGER,     -- Maximum scenario
    improvement_count INTEGER,
    prose_source      TEXT,        -- model | fallback
    pdf_bytes         INTEGER
  );
  CREATE INDEX IF NOT EXISTS reports_created_at_idx ON reports (created_at DESC);
  CREATE INDEX IF NOT EXISTS reports_college_idx ON reports (college_id);
`

const dbPath = process.env.DATABASE_PATH

let db = null
let insert = null
let selectByToken = null
let insertReport = null
if (dbPath) {
  mkdirSync(dirname(dbPath), { recursive: true })
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')   // better concurrency for read-while-write
  db.exec(SCHEMA)
  // Migration for databases created before share_token existed. ALTER throws if
  // the column is already present (fresh DBs get it from CREATE TABLE above), so
  // that one statement is guarded. The unique index is then created
  // unconditionally — by this point the column exists in both cases. (SQLite
  // treats NULLs as distinct, so legacy rows with a NULL token don't collide.)
  try { db.exec('ALTER TABLE submissions ADD COLUMN share_token TEXT') }
  catch { /* column already exists */ }
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS submissions_share_token_idx ON submissions (share_token)')
  insert = db.prepare(`
    INSERT INTO submissions
      (name, email, country, school_name, grade, sat, gpa, efc, majors, dream_schools, personality_type, result_count, consent_data, consent_offers, share_token, input, output)
    VALUES
      (@name, @email, @country, @school_name, @grade, @sat, @gpa, @efc, @majors, @dream_schools, @personality_type, @result_count, @consent_data, @consent_offers, @share_token, @input, @output)
  `)
  selectByToken = db.prepare('SELECT name, output FROM submissions WHERE share_token = ?')
  insertReport = db.prepare(`
    INSERT OR IGNORE INTO reports
      (report_key, college_id, engine_version, email, chance_before, chance_ceiling, improvement_count, prose_source, pdf_bytes)
    VALUES
      (@report_key, @college_id, @engine_version, @email, @chance_before, @chance_ceiling, @improvement_count, @prose_source, @pdf_bytes)
  `)
  console.log(`[db] storing submissions at ${dbPath}`)
}

export const dbEnabled = () => db !== null

// Persist one calculator run. `input` is the raw request body, `output` is the
// payload returned to the client. better-sqlite3 is synchronous, so this returns
// once the row is committed; it is fast (sub-millisecond) and fully guarded.
// Returns a fresh, unguessable share_token for this row (or null when no DB is
// configured / the save fails) so the caller can build a /r/:token share link.
// A new token is minted per call — never reused across rows — so two different
// students with an identical academic profile get distinct, correctly-named links.
export function saveSubmission(input, output) {
  if (!insert) return null
  try {
    const dreamIds = Array.isArray(input.dreamSchools)
      ? input.dreamSchools.map(s => s?.id || s).filter(Boolean)
      : []
    const shareToken = randomBytes(12).toString('base64url')  // ~16 url-safe chars
    insert.run({
      name: input.name || null,
      email: input.email || null,
      country: input.country || null,
      school_name: input.schoolName || null,
      grade: input.grade || null,
      sat: input.testScores?.sat || null,
      gpa: input.testScores?.gpa || null,
      efc: Number.isFinite(input.efc) ? input.efc : null,
      majors: JSON.stringify(Array.isArray(input.majors) ? input.majors : []),
      dream_schools: JSON.stringify(dreamIds),
      personality_type: output.personalityType || null,
      result_count: Array.isArray(output.schools) ? output.schools.length : 0,
      consent_data: input.consentData ? 1 : 0,
      consent_offers: input.consentOffers ? 1 : 0,
      share_token: shareToken,
      input: JSON.stringify(input),
      output: JSON.stringify(output),
    })
    return shareToken
  } catch (err) {
    console.error('[db] saveSubmission failed:', err.message)
    return null
  }
}

// Public, display-safe lookup for the shareable results page. Returns ONLY the
// first name and the stored output payload (personality + matches) — never email,
// scores, essay, or any other PII. Looked up by the unguessable share_token, not
// the enumerable row id, so links can't be walked. Returns null when not found.
export function getSubmissionByToken(token) {
  if (!selectByToken || typeof token !== 'string' || !token) return null
  const row = selectByToken.get(token)
  if (!row) return null
  const output = safeParse(row.output)
  if (!output || typeof output !== 'object' || output.insufficient) return null
  return {
    name: (row.name || '').trim().split(/\s+/)[0] || '',  // first name only
    output,
  }
}

// Record one report generation for the admin/analytics trail. Same contract as
// saveSubmission: silent no-op without a DB, and a failure never breaks the
// user's request. INSERT OR IGNORE — a cache-rebuild of an existing key is not
// an error.
export function saveReport(meta) {
  if (!insertReport) return
  try {
    insertReport.run({
      report_key: meta.reportKey,
      college_id: meta.collegeId,
      engine_version: meta.engineVersion,
      email: meta.email || null,
      chance_before: Number.isFinite(meta.chanceBefore) ? meta.chanceBefore : null,
      chance_ceiling: Number.isFinite(meta.chanceCeiling) ? meta.chanceCeiling : null,
      improvement_count: Number.isFinite(meta.improvementCount) ? meta.improvementCount : null,
      prose_source: meta.proseSource || null,
      pdf_bytes: Number.isFinite(meta.pdfBytes) ? meta.pdfBytes : null,
    })
  } catch (err) {
    console.error('[db] saveReport failed:', err.message)
  }
}

// Lightweight listing for the admin endpoint. Returns null when no DB is configured.
const LIST_COLS = 'id, created_at, name, email, country, school_name, grade, sat, gpa, efc, majors, dream_schools, personality_type, result_count, consent_data, consent_offers'
function safeParse(s) { try { return JSON.parse(s) } catch { return s } }

export function listSubmissions(limit) {
  if (!db) return null
  const rows = db.prepare(`SELECT ${LIST_COLS} FROM submissions ORDER BY created_at DESC LIMIT ?`).all(limit)
  return rows.map(r => ({ ...r, majors: safeParse(r.majors), dream_schools: safeParse(r.dream_schools) }))
}

// Full single submission, including the complete input (extracurriculars,
// honors, essay, all answers) and output. Returns null when not found / no DB.
export function getSubmission(id) {
  if (!db) return null
  const row = db.prepare('SELECT * FROM submissions WHERE id = ?').get(id)
  if (!row) return null
  return {
    ...row,
    majors: safeParse(row.majors),
    dream_schools: safeParse(row.dream_schools),
    input: safeParse(row.input),
    output: safeParse(row.output),
  }
}

// Totals for the public /stats page. Counts only: no row, name, email or school
// ever leaves this function, and countries are named without their counts.
// Country is whatever string the API was sent, so only names on the picker's
// list count. Returns null when no DB is configured.
const KNOWN_COUNTRIES = new Set(COUNTRIES)

export function getStats() {
  if (!db) return null
  const get = sql => db.prepare(sql).get()
  const countries = db.prepare('SELECT country, COUNT(*) AS n FROM submissions GROUP BY country ORDER BY n DESC, country')
    .all()
    .filter(c => KNOWN_COUNTRIES.has(c.country))
  return {
    ...get(`SELECT COUNT(*) AS assessments, COUNT(DISTINCT lower(email)) AS students,
              MIN(created_at) AS since,
              COALESCE(SUM(created_at >= datetime('now', '-7 days')), 0) AS lastWeek
            FROM submissions`),
    ...get(`SELECT COUNT(*) AS returners FROM (SELECT 1 FROM submissions
              WHERE email IS NOT NULL GROUP BY lower(email) HAVING COUNT(*) > 1)`),
    ...get('SELECT COUNT(*) AS reports, COUNT(DISTINCT college_id) AS colleges FROM reports'),
    countries: countries.length,
    countryNames: countries.map(c => c.country),   // most assessments first
  }
}
