#!/usr/bin/env node
/**
 * Fiske Guide extraction pipeline.
 *
 * Usage:
 *   node scripts/extract-fiske.mjs /path/to/fiske.pdf [model]
 *   node scripts/extract-fiske.mjs /path/to/fiske.pdf anthropic/claude-haiku-4-5
 *
 * Requires: pdftotext (brew install poppler)
 *
 * Output: server/data/schools.json
 * Intermediate: scripts/fiske-text.txt, server/data/schools-raw/<id>.json
 */

import { execSync, execFileSync } from 'child_process'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// --- Config ---
const FISKE_PDF = process.argv[2]
const MODEL_OVERRIDE = process.argv[3]  // optional: e.g. anthropic/claude-haiku-4-5
const TEXT_CACHE = join(__dirname, 'fiske-text.txt')
const TARGETS_FILE = join(__dirname, 'schools-target.json')
const OUTPUT_DIR = join(ROOT, 'server/data/schools-raw')
const FINAL_OUTPUT = join(ROOT, 'server/data/schools.json')
const CHUNK_SIZE = 10000  // chars per school chunk passed to AI
const RATE_LIMIT_MS = 400 // ms between API calls

if (!FISKE_PDF) {
  console.error('Usage: node scripts/extract-fiske.mjs /path/to/fiske.pdf')
  process.exit(1)
}

// --- Load .env ---
function loadEnv() {
  const envPath = join(ROOT, '.env')
  if (!existsSync(envPath)) throw new Error('.env not found at project root')
  return Object.fromEntries(
    readFileSync(envPath, 'utf8')
      .split('\n')
      .filter(l => l.includes('=') && !l.startsWith('#'))
      .map(l => {
        const idx = l.indexOf('=')
        return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()]
      })
  )
}

const env = loadEnv()
const API_KEY = env.OPENROUTER_API_KEY
const MODEL = MODEL_OVERRIDE || env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4-5'

if (!API_KEY) throw new Error('OPENROUTER_API_KEY not found in .env')

// --- Step 1: PDF → text ---
function extractPdfText() {
  if (existsSync(TEXT_CACHE)) {
    console.log(`Using cached text: ${TEXT_CACHE}`)
    return readFileSync(TEXT_CACHE, 'utf8')
  }

  // Check pdftotext is available
  try {
    execSync('which pdftotext', { stdio: 'pipe' })
  } catch {
    console.error('pdftotext not found. Install with: brew install poppler')
    process.exit(1)
  }

  console.log('Extracting PDF text (may take ~60 seconds)...')
  execFileSync('pdftotext', ['-layout', FISKE_PDF, TEXT_CACHE], { stdio: 'inherit' })
  console.log(`Saved to ${TEXT_CACHE}`)
  return readFileSync(TEXT_CACHE, 'utf8')
}

// --- Step 2: Find school section in raw text ---
function findSchoolChunk(text, schoolName) {
  // Fiske entries: school name appears as bold header, then stats sidebar
  // Also in page footers as "SCHOOL NAME  83"
  // Strategy: find name near characteristic keywords, grab surrounding context

  const escapedName = schoolName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  // Try name followed by stats keywords within ~800 chars
  const statKeywords = '(?:Location:|Strong Programs|Website:|Returning Freshmen)'
  const anchoredPattern = new RegExp(escapedName + '[\\s\\S]{0,800}' + statKeywords, 'i')
  let match = text.match(anchoredPattern)

  // Fallback: just find first occurrence
  if (!match) {
    const simplePattern = new RegExp(escapedName, 'i')
    match = text.match(simplePattern)
  }

  if (!match) return null

  const center = match.index + Math.floor(match[0].length / 2)
  const start = Math.max(0, center - 500)
  const end = Math.min(text.length, start + CHUNK_SIZE)
  return text.slice(start, end)
}

// --- Step 3: AI extraction ---
const EXTRACT_SYSTEM = `You extract structured college data from messy Fiske Guide text.
The text may include watermarks, page numbers, two-column layout artifacts, and pull quotes mixed into the main narrative.
Be precise and synthesis-focused. Return only valid JSON. No markdown fences. No explanation.`

const EXTRACT_SCHEMA = `{
  "name": "full official school name",
  "type": "Public or Private",
  "stats": {
    "undergraduates": "undergrad enrollment number as string e.g. '7,076' — null if not found",
    "accepted": "acceptance rate string e.g. '6%' — null if not found",
    "enrolled": "yield rate string — null if not found",
    "gradIn6Years": "6-year graduation rate string — null if not found",
    "returningFreshmen": "first-year retention rate string — null if not found"
  },
  "ratings": {
    "academics": <integer 1–5 based on Fiske checkmarks — null if not found>,
    "social": <integer 1–4 based on Fiske stars — null if not found>,
    "qualityOfLife": <integer 1–5 based on Fiske stars — null if not found>
  },
  "strongPrograms": ["array of program and department names"],
  "character": [
    "3–5 short bullets describing the type of student who thrives here",
    "e.g. 'Independent self-starters who design their own academic path'",
    "e.g. 'Pre-professional and career-driven, not purely intellectual'",
    "e.g. 'Collaborative rather than cutthroat — students help each other'"
  ],
  "academicEnvironment": "1–2 sentences: competitive vs collaborative, grade-focused vs learning-focused, seminar vs lecture, research opportunities, academic pressure level",
  "socialScene": "1–2 sentences: Greek life presence, athletics culture, urban vs campus social life, party scene vs low-key, community feel",
  "notableFeatures": ["distinctive programs, policies, or opportunities — e.g. 'Open curriculum — no required courses', 'Co-op program', 'Strong undergraduate research', 'Pass/Fail option'"],
  "studentQuotes": [
    "2–4 verbatim quotes from students as they appear in the Fiske entry — these are italicized or in quotation marks in the text",
    "e.g. 'Brown's open curriculum, though not for everyone, is incredibly liberating.'",
    "e.g. 'As far as I know, all our academic departments are super strong.'"
  ],
  "admissionsNotes": "1–2 sentences on what Fiske says admissions looks for, any special hooks or considerations — null if not mentioned",
  "weaknesses": [
    "2–4 bullets on genuine weaknesses or downsides Fiske mentions",
    "e.g. 'Large introductory lecture classes with limited professor access'",
    "e.g. 'Social scene can feel cliquey and Greek-life dominated'",
    "e.g. 'Grade deflation creates intense academic pressure'"
  ],
  "bestForStudents": "1–2 sentences explicitly stating who this school is ideal for and who would struggle — synthesized from the Fiske entry",
  "narrative": "3–4 paragraph prose summary covering culture, academics, student life, and what makes this school distinctive — clean, no financial data, no watermarks, no page numbers, ~400 words"
}`

async function extractWithAI(schoolName, chunk) {
  const userPrompt = `Extract structured data for ${schoolName} from this Fiske Guide to Colleges entry.

Rules:
- Ignore ALL financial data (expense tier, financial aid %, student loans, average debt, Pell grants)
- Strip watermarks, page numbers, and PDF artifacts from the narrative
- For "character": synthesize from the text — what kind of student thrives here? Be specific and direct
- For "academicEnvironment": one honest sentence on academic culture and pressure level
- For "socialScene": one honest sentence on the actual social experience
- For "notableFeatures": only include genuinely distinctive things, not generic facts
- For "studentQuotes": copy them verbatim — they are in quotation marks or italics in the Fiske text, attributed to students (e.g. "says a junior", "explains a sophomore")
- For "weaknesses": be honest — Fiske is candid about negatives, extract them faithfully
- For "bestForStudents": be specific, not generic — "self-directed students who thrive without structure" not "students who want a good education"

RAW TEXT:
${chunk}

Return JSON matching this schema exactly:
${EXTRACT_SCHEMA}`

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: EXTRACT_SYSTEM },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 2600,
      response_format: { type: 'json_object' },
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('Empty response from API')
  const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  return JSON.parse(cleaned)
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// --- Main ---
mkdirSync(OUTPUT_DIR, { recursive: true })

const targets = JSON.parse(readFileSync(TARGETS_FILE, 'utf8'))
const fullText = extractPdfText()
console.log(`Loaded ${(fullText.length / 1e6).toFixed(1)}MB of text. Processing ${targets.length} schools...\n`)

const notFound = []
const failed = []
let processed = 0
let cached = 0

for (const school of targets) {
  const outFile = join(OUTPUT_DIR, `${school.id}.json`)

  if (existsSync(outFile)) {
    process.stdout.write(`  ✓ ${school.name} (cached)\n`)
    cached++
    continue
  }

  const chunk = findSchoolChunk(fullText, school.searchName || school.name)
  if (!chunk) {
    process.stdout.write(`  ✗ ${school.name} — not found in PDF\n`)
    notFound.push(school.name)
    continue
  }

  try {
    const result = await extractWithAI(school.name, chunk)
    result.id = school.id
    result.category = school.category
    writeFileSync(outFile, JSON.stringify(result, null, 2))
    process.stdout.write(`  ✓ ${school.name}\n`)
    processed++
    await sleep(RATE_LIMIT_MS)
  } catch (err) {
    process.stdout.write(`  ✗ ${school.name} — ${err.message}\n`)
    failed.push(school.name)
    await sleep(RATE_LIMIT_MS)
  }
}

// Merge into final output
const schools = targets
  .map(s => {
    const f = join(OUTPUT_DIR, `${s.id}.json`)
    return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null
  })
  .filter(Boolean)

writeFileSync(FINAL_OUTPUT, JSON.stringify(schools, null, 2))

console.log(`\n--- Done ---`)
console.log(`  Extracted: ${processed}  Cached: ${cached}  Total saved: ${schools.length}`)
if (notFound.length) console.log(`  Not found in PDF (${notFound.length}): ${notFound.join(', ')}`)
if (failed.length) console.log(`  API errors (${failed.length}): ${failed.join(', ')}`)
console.log(`  Output: ${FINAL_OUTPUT}`)
