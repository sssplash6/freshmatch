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
`

const dbPath = process.env.DATABASE_PATH

let db = null
let insert = null
let selectByToken = null
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
