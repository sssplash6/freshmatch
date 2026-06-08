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

function compressSchool(school) {
  const accept  = school.stats?.accepted ? `${school.stats.accepted}% admit` : ''
  const programs = (school.strongPrograms || []).slice(0, 5).join(', ')
  const chars   = (school.character || []).slice(0, 3).join('; ')
  return [
    `[${school.id}] ${school.name}${accept ? ` (${accept})` : ''}`,
    programs ? `Programs: ${programs}` : '',
    chars    ? `Character: ${chars}` : '',
    school.academicEnvironment ? `Academic feel: ${school.academicEnvironment}` : '',
    school.bestForStudents     ? `Best for: ${school.bestForStudents}` : '',
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

    const studentSummary = buildStudentSummary({ name, testScores, extracurriculars, honors, essay, efc })
    const schoolList = eligible.map(compressSchool).join('\n\n---\n\n')

    const systemPrompt = `You are a senior college admissions counselor at Freshman Academy, specializing in placing international students at US universities. You have deep knowledge of each school's culture, academics, and what truly makes a student thrive there. Be specific and honest — vague praise wastes everyone's time.`

    // Build a lookup for post-AI validation — name comes from our data, not the model
    const eligibleMap = new Map(eligible.map(s => [s.id, s]))

    const userMessage = `Student profile:

${studentSummary}

The ${eligible.length} schools below have already passed financial screening. You MUST select ONLY from this exact list — do not suggest any school not shown here, even if you know of other good fits.

Select the 10–15 best matches from this list.

For each chosen school return:
- "id": the bracketed [id] shown (copy it exactly)
- "name": school name
- "fitScore": integer 0–100 (reserve 90+ for exceptional matches)
- "narrative": 2–3 sentences specific to THIS student — not generic praise, explain WHY their background connects to this school's character
- "matchReasons": array of 2–3 strings (concrete connections)
- "concerns": array of 1–2 strings (honest challenges or limitations)

Return exactly: { "schools": [...] } sorted by fitScore descending. No markdown fences, no extra keys.

Schools (choose ONLY from these):

${schoolList}`

    const raw = await chat(
      [{ role: 'user', content: userMessage }],
      { systemPrompt, max_tokens: 8000, response_format: { type: 'json_object' } }
    )

    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

    let parsed
    try {
      parsed = JSON.parse(cleaned)
    } catch (parseErr) {
      console.error('JSON parse failed:', parseErr.message)

      // Strategy 1: use error position to find last valid entry before the break
      const posMatch = parseErr.message.match(/position (\d+)/)
      const breakPos = posMatch ? parseInt(posMatch[1]) : cleaned.length
      const beforeBreak = cleaned.lastIndexOf('},', breakPos)
      if (beforeBreak > 10) {
        try { parsed = JSON.parse(cleaned.slice(0, beforeBreak + 1) + ']}') } catch (_) {}
      }

      // Strategy 2: full-string fallback — last }, anywhere
      if (!parsed) {
        const lastEntry = cleaned.lastIndexOf('},')
        if (lastEntry > 10) {
          try { parsed = JSON.parse(cleaned.slice(0, lastEntry + 1) + ']}') } catch (_) {}
        }
      }

      // Strategy 3: last } (final entry may lack trailing comma)
      if (!parsed) {
        const lastBrace = cleaned.lastIndexOf('}')
        if (lastBrace > 10) {
          try { parsed = JSON.parse(cleaned.slice(0, lastBrace + 1) + ']}') } catch (_) {}
        }
      }

      if (!parsed) throw new Error('AI response could not be parsed — please try again')
    }

    // Hard guard — two passes:
    // 1. Discard any school whose id wasn't in the financially-eligible list
    // 2. Overwrite name with our authoritative value (immune to AI misspellings)
    const results = (parsed.schools || [])
      .filter(s => eligibleMap.has(s.id))
      .map(s => ({ ...s, name: eligibleMap.get(s.id).name }))

    res.json({ schools: results })
  } catch (err) {
    console.error('/api/narrate error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
