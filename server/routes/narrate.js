import { readFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { Router } from 'express'
import { chat } from '../_openrouter.js'

const __dir = dirname(fileURLToPath(import.meta.url))
const DATA = join(__dir, '../data')

// EFC → minimum avg aid required
const EFC_BRACKETS = [
  { max: 15000,  minAid: 70000 },
  { max: 25000,  minAid: 55000 },
  { max: 40000,  minAid: 40000 },
  { max: 60000,  minAid: 25000 },
  { max: 80000,  minAid: 10000 },
  { max: Infinity, minAid: 0   },
]
const BUFFER = 0.20

// Need-blind campuses: financial filter never applies, always eligible.
const NEED_BLIND_IDS = new Set(['nyuad', 'cmu-q', 'gu-q'])

// Minimum EFC required (school has its own aid structure, not need-blind).
// nyush: open to students with EFC > $15k (has family contribution capacity).
const EFC_MIN = {
  'nyush': 15001,
}

// Aspirational US campuses: only surface to EFC > $60k students.
// Georgetown/NYU give generous aid but their cost structure and US-specific benefits
// make them appropriate only once family contribution capacity is substantial.
const EFC_FLOOR = {
  'georgetown': 60001,
  'nyu':        60001,
}

// Branch campus → parent school id for Fiske fit profile lookup.
// NYUAD and NYUSH have their own Fiske profiles; cmu-q and gu-q share parent profiles.
const FIT_PROXY = {
  'cmu-q': 'carnegie-mellon',
  'gu-q':  'georgetown',
}

function isFinanciallyEligible(efc, school) {
  if (NEED_BLIND_IDS.has(school.id)) return true
  if (EFC_MIN[school.id] !== undefined) return efc >= EFC_MIN[school.id]
  if (EFC_FLOOR[school.id] && efc < EFC_FLOOR[school.id]) return false
  if (school.noAid) return efc > 80000
  if (school.avgAid === null) return false
  const bracket = EFC_BRACKETS.find(b => efc <= b.max)
  return school.avgAid >= bracket.minAid * (1 - BUFFER)
}

// Loaded once per server process. Restart the server after editing JSON data files.
let schoolsCache = null
let financialCache = null
let schoolsByIdCache = null

async function loadData() {
  if (!schoolsCache) {
    const [rawSchools, rawFinancial] = await Promise.all([
      readFile(join(DATA, 'schools.json'), 'utf8'),
      readFile(join(DATA, 'schools-financial.json'), 'utf8'),
    ])
    schoolsCache = JSON.parse(rawSchools)
    financialCache = JSON.parse(rawFinancial)
    schoolsByIdCache = Object.fromEntries(schoolsCache.map(s => [s.id, s]))
  }
  return { schools: schoolsCache, financial: financialCache, schoolsById: schoolsByIdCache }
}

function efcLabel(efc) {
  if (efc <= 15000) return '$0–$15k'
  if (efc <= 25000) return '$15–$25k'
  if (efc <= 40000) return '$25–$40k'
  if (efc <= 60000) return '$40–$60k'
  if (efc <= 80000) return '$60–$80k'
  return '$80k+'
}

function buildStudentSummary({ name, testScores, extracurriculars, honors, essay, efc }) {
  const tests = [
    testScores?.gpa   && `GPA: ${testScores.gpa}/${testScores.gpaScale || '4'}`,
    testScores?.sat   && `SAT: ${testScores.sat}`,
    testScores?.ielts && `IELTS: ${testScores.ielts}`,
    testScores?.alevels && `A-Levels: ${JSON.stringify(testScores.alevels)}`,
    testScores?.ib    && `IB: ${testScores.ib}`,
    testScores?.ap    && `AP: ${JSON.stringify(testScores.ap)}`,
  ].filter(Boolean).join(' | ')

  const ecs = (extracurriculars || [])
    .filter(e => e.description?.trim())
    .map((e, i) => `${i + 1}. ${e.description.trim()}`)
    .join('\n')

  const honorsStr = (honors || [])
    .filter(h => h.title?.trim())
    .map(h => `- ${h.title} (${h.level}${h.participants ? `, ~${h.participants} participants` : ''})`)
    .join('\n')

  return [
    `Student: ${name}`,
    `Academic scores: ${tests || 'not provided'}`,
    `EFC bracket: ${efcLabel(efc)}`,
    ecs        ? `Extracurriculars:\n${ecs}` : '',
    honorsStr  ? `Honors/awards:\n${honorsStr}` : '',
    essay?.trim() ? `Personal statement (excerpt): "${essay.trim().slice(0, 600)}"` : '',
  ].filter(Boolean).join('\n\n')
}

// Max schools sent to AI — caps prompt size for high-EFC students who pass 100+ schools
const MAX_ELIGIBLE = 50

function compressSchool(school) {
  const accept   = school.stats?.accepted ? `${school.stats.accepted}% admit` : ''
  const programs = (school.strongPrograms || []).slice(0, 3).join(', ')
  return [
    `[${school.id}] ${school.name}${accept ? ` (${accept})` : ''}`,
    programs ? `Programs: ${programs}` : '',
    school.academicEnvironment ? `Feel: ${school.academicEnvironment.slice(0, 120)}` : '',
    school.bestForStudents ? `For: ${school.bestForStudents.slice(0, 80)}` : '',
  ].filter(Boolean).join('\n')
}

const router = Router()

router.post('/', async (req, res) => {
  try {
    const { name, testScores, extracurriculars, honors, essay, efc } = req.body

    if (efc === null || efc === undefined) {
      return res.status(400).json({ error: 'EFC is required' })
    }

    const { schools, financial, schoolsById } = await loadData()

    const finById = Object.fromEntries(financial.map(f => [f.id, f]))

    // Merge Fiske + financial, resolve branch-campus proxies
    const eligible = []
    for (const fin of financial) {
      if (!isFinanciallyEligible(efc, fin)) continue

      // Resolve Fiske profile: branch campuses use their parent's profile
      const fiskeId = FIT_PROXY[fin.id] || fin.id
      const fiskeProfile = schoolsByIdCache[fiskeId]
      if (!fiskeProfile) continue  // no Fiske data for this school

      eligible.push({
        ...fiskeProfile,
        id: fin.id,        // keep the actual id (e.g. cmu-q, not carnegie-mellon)
        name: fin.name,    // keep the actual display name from financial DB
      })
    }

    if (eligible.length === 0) {
      return res.json({ schools: [] })
    }

    // Cap to avoid ballooning input tokens for high-EFC students
    const pool = eligible.length > MAX_ELIGIBLE ? eligible.slice(0, MAX_ELIGIBLE) : eligible

    const studentSummary = buildStudentSummary({ name, testScores, extracurriculars, honors, essay, efc })
    const schoolList = pool.map(compressSchool).join('\n---\n')

    const systemPrompt = `You are a senior college admissions counselor at Freshman Academy, specializing in placing international students at US universities. You have deep knowledge of each school's culture, academics, and what truly makes a student thrive there. Be specific and honest — vague praise wastes everyone's time.`

    // Build a lookup for post-AI validation — name comes from our data, not the model
    const eligibleMap = new Map(pool.map(s => [s.id, s]))

    const userMessage = `Student profile:

${studentSummary}

Pick the 10–14 best matches from the ${pool.length} schools below. ONLY use schools from this list.

For each school return:
- "id": exact bracketed [id]
- "name": school name
- "fitScore": integer 0–100
- "narrative": 1–2 sentences — WHY this student fits this school specifically
- "matchReasons": 2–3 short strings
- "concerns": 1–2 short strings

Return exactly: { "schools": [...] } sorted by fitScore desc. No markdown, no extra keys.

Schools:

${schoolList}`

    const raw = await chat(
      [{ role: 'user', content: userMessage }],
      { systemPrompt, max_tokens: 6000, response_format: { type: 'json_object' } }
    )

    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

    // Extract the outermost { ... } block — handles trailing prose after valid JSON.
    function extractJSON(str) {
      const start = str.indexOf('{')
      if (start === -1) return str
      let depth = 0, inStr = false, esc = false
      for (let i = start; i < str.length; i++) {
        const c = str[i]
        if (esc)              { esc = false; continue }
        if (c === '\\' && inStr) { esc = true; continue }
        if (c === '"')        { inStr = !inStr; continue }
        if (!inStr) {
          if (c === '{') depth++
          else if (c === '}' && --depth === 0) return str.slice(start, i + 1)
        }
      }
      return str.slice(start)
    }

    // Escape literal control characters that appear inside JSON string values.
    // Models occasionally emit unescaped newlines/tabs in narrative fields which
    // breaks JSON.parse even though the structure is otherwise valid.
    function sanitizeControlChars(str) {
      let out = ''
      let inString = false
      let escaped = false
      for (let i = 0; i < str.length; i++) {
        const c = str[i]
        if (escaped)          { out += c; escaped = false; continue }
        if (c === '\\')       { out += c; escaped = true;  continue }
        if (c === '"')        { inString = !inString; out += c; continue }
        if (inString) {
          if      (c === '\n') { out += '\\n'; continue }
          else if (c === '\r') { out += '\\r'; continue }
          else if (c === '\t') { out += '\\t'; continue }
          else if (c.charCodeAt(0) < 0x20) { continue }
        }
        out += c
      }
      return out
    }

    const prepared = sanitizeControlChars(extractJSON(cleaned))

    let parsed
    try {
      parsed = JSON.parse(prepared)
    } catch (parseErr) {
      console.error('JSON parse failed:', parseErr.message)

      // Strategy 1: use error position to find last valid entry before the break
      const posMatch = parseErr.message.match(/position (\d+)/)
      const breakPos = posMatch ? parseInt(posMatch[1]) : prepared.length
      const beforeBreak = prepared.lastIndexOf('},', breakPos)
      if (beforeBreak > 10) {
        try { parsed = JSON.parse(sanitizeControlChars(prepared.slice(0, beforeBreak + 1) + ']}')) } catch (_) {}
      }

      // Strategy 2: full-string fallback — last }, anywhere
      if (!parsed) {
        const lastEntry = prepared.lastIndexOf('},')
        if (lastEntry > 10) {
          try { parsed = JSON.parse(sanitizeControlChars(prepared.slice(0, lastEntry + 1) + ']}')) } catch (_) {}
        }
      }

      // Strategy 3: last } (final entry may lack trailing comma)
      if (!parsed) {
        const lastBrace = prepared.lastIndexOf('}')
        if (lastBrace > 10) {
          try { parsed = JSON.parse(sanitizeControlChars(prepared.slice(0, lastBrace + 1) + ']}')) } catch (_) {}
        }
      }

      if (!parsed) throw new Error('AI response could not be parsed — please try again')
    }

    // Hard guard — two passes:
    // 1. Discard any school whose id wasn't in the financially-eligible list
    // 2. Overwrite name with our authoritative value (immune to AI misspellings)
    const aiSchools = (parsed.schools || [])
      .map(s => ({ ...s, id: s.id?.replace(/^\[|\]$/g, '') }))

    const results = aiSchools
      .filter(s => eligibleMap.has(s.id))
      .map(s => ({ ...s, name: eligibleMap.get(s.id).name }))

    res.json({ schools: results })
  } catch (err) {
    console.error('/api/narrate error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
