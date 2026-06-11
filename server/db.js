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
    input            TEXT NOT NULL, -- full request body, JSON
    output           TEXT NOT NULL  -- full response payload, JSON
  );
  CREATE INDEX IF NOT EXISTS submissions_created_at_idx ON submissions (created_at DESC);
  CREATE INDEX IF NOT EXISTS submissions_email_idx ON submissions (email);
`

const dbPath = process.env.DATABASE_PATH

let db = null
let insert = null
if (dbPath) {
  mkdirSync(dirname(dbPath), { recursive: true })
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')   // better concurrency for read-while-write
  db.exec(SCHEMA)
  insert = db.prepare(`
    INSERT INTO submissions
      (name, email, country, school_name, grade, sat, gpa, efc, majors, dream_schools, personality_type, result_count, input, output)
    VALUES
      (@name, @email, @country, @school_name, @grade, @sat, @gpa, @efc, @majors, @dream_schools, @personality_type, @result_count, @input, @output)
  `)
  console.log(`[db] storing submissions at ${dbPath}`)
}

export const dbEnabled = () => db !== null

// Persist one calculator run. `input` is the raw request body, `output` is the
// payload returned to the client. better-sqlite3 is synchronous, so this returns
// once the row is committed; it is fast (sub-millisecond) and fully guarded.
export function saveSubmission(input, output) {
  if (!insert) return
  try {
    const dreamIds = Array.isArray(input.dreamSchools)
      ? input.dreamSchools.map(s => s?.id || s).filter(Boolean)
      : []
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
      input: JSON.stringify(input),
      output: JSON.stringify(output),
    })
  } catch (err) {
    console.error('[db] saveSubmission failed:', err.message)
  }
}

// Lightweight listing for the admin endpoint. Returns null when no DB is configured.
const LIST_COLS = 'id, created_at, name, email, country, school_name, grade, sat, gpa, efc, majors, dream_schools, personality_type, result_count'
function safeParse(s) { try { return JSON.parse(s) } catch { return s } }

export function listSubmissions(limit) {
  if (!db) return null
  const rows = db.prepare(`SELECT ${LIST_COLS} FROM submissions ORDER BY created_at DESC LIMIT ?`).all(limit)
  return rows.map(r => ({ ...r, majors: safeParse(r.majors), dream_schools: safeParse(r.dream_schools) }))
}
