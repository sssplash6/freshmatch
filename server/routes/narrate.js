import { readFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { Router } from 'express'
import { chat } from '../_openrouter.js'
import { saveSubmission } from '../db.js'

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
// duke: Karsh International Scholarship covers full cost for 35 recipients — merit only, EFC irrelevant.
const NEED_BLIND_IDS = new Set(['nyuad', 'cmu-q', 'gu-q', 'duke'])

// Minimum EFC required (school has its own aid structure, not need-blind).
// nyush/dku: families must have some contribution capacity to cover remaining costs.
const EFC_MIN = {
  'nyush': 15001,
  'dku':   15001,
}

// School-specific minimum SAT score — hard gate regardless of composite strength.
// colby: college policy requires SAT ≥ 1540 for international applicants.
const SAT_MINIMUMS = {
  'colby': 1540,
}

// School-specific composite strength floor — overrides tier-based gate.
// duke: Karsh is ivy-level competition; only surface to students who can realistically compete.
const STRENGTH_FLOORS = {
  'duke': 76,
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

// Composite academic strength score (0–100) across SAT, GPA, honors, and ECs.
// Honors level can compensate for a lower SAT — an olympiad winner with 1480 should
// still reach elite schools; a 1470 with zero achievements should not.
function academicStrength(testScores, honors, extracurriculars) {
  let score = 0

  // SAT (0–40)
  const sat = parseInt(testScores?.sat) || 0
  score += sat >= 1580 ? 40 : sat >= 1550 ? 34 : sat >= 1520 ? 28 :
           sat >= 1490 ? 22 : sat >= 1460 ? 16 : sat >= 1420 ? 10 :
           sat >= 1380 ?  5 : 0

  // GPA normalized to /4 scale (0–20)
  const gpa   = parseFloat(testScores?.gpa)
  const scale = parseFloat(testScores?.gpaScale) || 4
  if (gpa && scale) {
    const norm = (gpa / scale) * 4
    score += norm >= 3.9 ? 20 : norm >= 3.7 ? 15 : norm >= 3.5 ? 10 : norm >= 3.0 ? 5 : 0
  }

  // Honors (0–30, capped) — higher level awards carry much more weight
  const honorPts = { intl: 15, natl: 10, regional: 5, school: 2 }
  const honorsTotal = (honors || [])
    .filter(h => h.title?.trim())
    .reduce((sum, h) => sum + (honorPts[h.level] || 0), 0)
  score += Math.min(honorsTotal, 30)

  // ECs (0–10)
  const filledEcs = (extracurriculars || []).filter(e => e.description?.trim()).length
  score += Math.min(Math.round(filledEcs * 1.5), 10)

  return score  // max ~100
}

// Minimum composite strength required per admit-rate tier
const ACADEMIC_GATES = [
  { maxRate: 5,  minStrength: 76 },  // MIT, Stanford, Harvard, Yale, NYUAD
  { maxRate: 10, minStrength: 58 },  // Princeton, Brown, Dartmouth, Duke, Cornell
  { maxRate: 15, minStrength: 44 },  // Columbia, JHU, Northwestern, Vanderbilt
  { maxRate: 20, minStrength: 32 },  // Pomona, Swarthmore, Williams, Amherst
]

// Fiske data errors and gaps — correct wrong admit rates, fill nulls.
// Without a rate a school bypasses the academic gate AND gets the generic
// dream-chance fallback, so selective schools here would be badly mis-scored.
const ADMIT_RATE_OVERRIDES = {
  'upenn':        7,
  'wustl':        12,
  'uva':          17,
  'unc':          16,
  'northeastern': 6,
  'purdue':       50,
  'rutgers':      65,
  'uoregon':      85,
  'susquehanna':  78,
}

// Deterministic admission-chance score for dream schools (0–100).
// Computed from our strength composite + admit rate so repeat runs return
// IDENTICAL numbers — the AI writes the narrative around this value, it does
// not choose it. Tune the curve here, not in the prompt.
const DREAM_RATE_FALLBACK = 15  // dream school missing admit-rate data
function dreamChanceScore(strength, school) {
  const raw = ADMIT_RATE_OVERRIDES[school.id] ?? parseFloat(school.stats?.accepted)
  const rate = isNaN(raw) ? DREAM_RATE_FALLBACK : Math.min(Math.max(raw, 2), 60)
  // strength 85 → ~59 at a 4% school, ~65 at 9%, ~78 at 20%; strength 50 → ~32 at 4%
  return Math.round(Math.min(92, Math.max(5, strength * 0.75 + rate * 1.2 - 10)))
}

// Financial-reality multiplier for dream-school chance scores. Most US schools
// are need-AWARE for international applicants, so needing more aid than a
// school typically gives lowers admission odds — not just enrollment odds.
// The penalty scales with how much of the needed aid the school actually
// covers: near-miss generous schools are barely touched; schools whose aid is
// a fraction of the family's need take the real hit. Need-aware alone is not
// a penalty — only an actual aid shortfall is.
function dreamFinancialPenalty(efc, fin) {
  if (!fin) return 1                              // no financial data — don't guess
  if (isFinanciallyEligible(efc, fin)) return 1   // aid covers this bracket
  if (fin.noAid || fin.avgAid == null) return 0.4 // can't realistically fund attendance
  const minAid = EFC_BRACKETS.find(b => efc <= b.max).minAid
  if (minAid <= 0) return 1
  const coverage = fin.avgAid / minAid            // eligibility passes at ≥ 0.8 (BUFFER)
  // coverage 0.8 → 1.0 (continuous with the eligible case), 0 → 0.4 floor
  return Math.max(0.4, Math.min(1, 0.4 + coverage * 0.75))
}

function isAcademicallyEligible(strength, school, testScores) {
  // Hard SAT floor for specific schools
  const satMin = SAT_MINIMUMS[school.id]
  if (satMin !== undefined && (parseInt(testScores?.sat) || 0) < satMin) return false

  // School-specific strength floor (takes precedence over tier-based gate)
  const floor = STRENGTH_FLOORS[school.id]
  if (floor !== undefined) return strength >= floor

  const rate = ADMIT_RATE_OVERRIDES[school.id] ?? parseFloat(school.stats?.accepted)
  if (isNaN(rate)) return true
  const gate = ACADEMIC_GATES.find(g => rate <= g.maxRate)
  return gate ? strength >= gate.minStrength : true
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

// Does any of the student's desired majors line up with a school's strong programs?
function majorMatches(majors, school) {
  if (!majors?.length) return false
  const progs = (school.strongPrograms || []).map(p => p.toLowerCase())
  return majors.some(m => {
    const ml = m.toLowerCase()
    return progs.some(p => p.includes(ml) || ml.includes(p))
  })
}

// Personality questions map every option to one of four archetypes by letter.
// Shown only when the student skips the essay — this tally substitutes for the
// signal the essay would have carried.
const ARCHETYPES = {
  A: 'STEM / technical mastery (research, labs, deep specialization)',
  B: 'Leadership, policy & global affairs (debate, networks, tradition)',
  C: 'Intellectual life of the mind (theory, philosophy, great books, open inquiry)',
  D: 'Entrepreneurial builder (startups, hands-on projects, tangible impact)',
}

function personalityProfile(personality) {
  const answers = Object.values(personality || {}).filter(l => ARCHETYPES[l])
  if (!answers.length) return ''
  const tally = answers.reduce((m, l) => ({ ...m, [l]: (m[l] || 0) + 1 }), {})
  const ranked = Object.entries(tally).sort((a, b) => b[1] - a[1])
  const lines = ranked.map(([l, n]) => `- ${ARCHETYPES[l]} — ${n}/${answers.length}`)
  return `Personality profile (student skipped the essay; derived from a 6-question quiz, strongest lean first — weight the dominant archetype when judging cultural and programmatic fit):\n${lines.join('\n')}`
}

function buildStudentSummary({ name, country, grade, testScores, extracurriculars, honors, essay, personality, majors, efc }) {
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
    .map(h => `- ${h.title} (${h.level})`)
    .join('\n')

  return [
    `Student: ${name}${country ? ` — applying from ${country}` : ''}${grade ? ` (${grade})` : ''}`,
    `Academic scores: ${tests || 'not provided'}`,
    `EFC bracket: ${efcLabel(efc)}`,
    majors?.length ? `Desired majors: ${majors.join(', ')}` : '',
    ecs        ? `Extracurriculars:\n${ecs}` : '',
    honorsStr  ? `Honors/awards:\n${honorsStr}` : '',
    essay?.trim() ? `Personal statement (excerpt): "${essay.trim().slice(0, 600)}"` : '',
    essay?.trim() ? '' : personalityProfile(personality),
  ].filter(Boolean).join('\n\n')
}

// Max schools sent to AI — caps prompt size for high-EFC students who pass 100+ schools
const MAX_ELIGIBLE = 50

function compressSchool(school) {
  const accept   = school.stats?.accepted ? `${school.stats.accepted}% admit` : ''
  const programs = (school.strongPrograms || []).slice(0, 3).join(', ')
  const aid      = school.avgAid != null
    ? `Avg aid: $${Math.round(school.avgAid).toLocaleString()}/yr`
    : (school.noAid ? 'No need-based aid (full-pay only)' : '')
  return [
    `${school.id} | ${school.name}${accept ? ` (${accept})` : ''}`,
    programs ? `Programs: ${programs}` : '',
    school.academicEnvironment ? `Feel: ${school.academicEnvironment.slice(0, 120)}` : '',
    school.bestForStudents ? `For: ${school.bestForStudents.slice(0, 80)}` : '',
    aid,
  ].filter(Boolean).join('\n')
}

const router = Router()

// Same profile → same response, byte for byte. Also saves the OpenRouter call
// on re-runs. In-memory only; cleared on server restart.
const responseCache = new Map()
const CACHE_MAX = 50
// Concurrent duplicate requests (e.g. React StrictMode double-mount) share one
// OpenRouter call instead of firing two.
const inflight = new Map()

router.post('/', async (req, res) => {
  let cacheKey = null
  let settleInflight = null
  try {
    const { name, country, grade, testScores, extracurriculars, honors, essay, personality, majors, dreamSchools, efc } = req.body

    if (efc === null || efc === undefined) {
      return res.status(400).json({ error: 'EFC is required' })
    }

    // Data-processing consent is mandatory to run the calculation.
    if (req.body.consentData !== true) {
      return res.status(400).json({ error: 'Consent is required to generate results' })
    }

    cacheKey = JSON.stringify({ name, country, grade, testScores, extracurriculars, honors, essay, personality, majors, dreamSchools, efc })
    if (responseCache.has(cacheKey)) {
      const payload = responseCache.get(cacheKey)
      saveSubmission(req.body, payload)  // different user, same academic profile → still record it
      return res.json(payload)
    }
    if (inflight.has(cacheKey)) {
      // A concurrent duplicate of THIS request (e.g. React StrictMode double-mount).
      // The original request records the submission; don't double-count it here.
      const payload = await inflight.get(cacheKey)
      return res.json(payload)
    }
    const inflightPromise = new Promise((resolve, reject) => {
      settleInflight = { resolve, reject }
    })
    inflightPromise.catch(() => {})  // avoid unhandled rejection when no second waiter
    inflight.set(cacheKey, inflightPromise)

    const { schools, financial, schoolsById } = await loadData()

    const finById = Object.fromEntries(financial.map(f => [f.id, f]))
    const strength = academicStrength(testScores, honors, extracurriculars)

    // Merge Fiske + financial, resolve branch-campus proxies
    const eligible = []
    for (const fin of financial) {
      if (!isFinanciallyEligible(efc, fin)) continue

      // Resolve Fiske profile: branch campuses use their parent's profile
      const fiskeId = FIT_PROXY[fin.id] || fin.id
      const fiskeProfile = schoolsByIdCache[fiskeId]
      if (!fiskeProfile) continue  // no Fiske data for this school

      const merged = { ...fiskeProfile, id: fin.id, name: fin.name, avgAid: fin.avgAid, noAid: fin.noAid }
      if (!isAcademicallyEligible(strength, merged, testScores)) continue

      eligible.push(merged)
    }

    // Resolve dream school profiles (bypass filters — student asked for honest evaluation)
    const dreamIds = Array.isArray(dreamSchools) ? dreamSchools.map(s => s.id || s).filter(Boolean) : []
    const dreamPool = []
    for (const id of dreamIds) {
      const fiskeId = FIT_PROXY[id] || id
      const fiskeProfile = schoolsByIdCache[fiskeId]
      const finEntry = finById[id]
      // Fall back to a stub if the school isn't in our Fiske data — AI still has general knowledge
      const merged = fiskeProfile
        ? { ...fiskeProfile, id, name: finEntry?.name || fiskeProfile.name, avgAid: finEntry?.avgAid, noAid: finEntry?.noAid }
        : { id, name: finEntry?.name || dreamSchools.find(s => (s.id || s) === id)?.name || id, avgAid: finEntry?.avgAid, noAid: finEntry?.noAid }
      dreamPool.push(merged)
    }

    if (eligible.length === 0 && dreamPool.length === 0) {
      const empty = { schools: [], dreamSchools: [] }
      saveSubmission(req.body, empty)  // fire-and-forget; never blocks the response
      settleInflight?.resolve(empty)
      inflight.delete(cacheKey)
      return res.json(empty)
    }

    // Cap to avoid ballooning input tokens for high-EFC students.
    // The financial file is prestige-ordered, so a plain slice would send the AI
    // only the most selective schools. Rank by: (1) school is strong in a
    // desired major, (2) how well its selectivity matches this student
    // (chance ≈ 55 is a solid match) — so the pool spans reaches, matches,
    // and safeties weighted toward the student's intended field.
    const pool = eligible.length > MAX_ELIGIBLE
      ? [...eligible]
          .sort((a, b) =>
            (majorMatches(majors, b) - majorMatches(majors, a)) ||
            (Math.abs(dreamChanceScore(strength, a) - 55) - Math.abs(dreamChanceScore(strength, b) - 55)))
          .slice(0, MAX_ELIGIBLE)
      : eligible

    // Combine: dream schools first (de-duped from eligible pool to avoid double entries)
    const dreamIdSet = new Set(dreamIds)
    const regularPool = pool.filter(s => !dreamIdSet.has(s.id))

    // Chance scores are OURS, not the model's — computed once, identical every run.
    // Academic chance × financial-reality penalty (need-aware schools, aid shortfalls).
    const dreamChance = new Map(dreamPool.map(s => {
      const penalty = dreamFinancialPenalty(efc, finById[s.id])
      return [s.id, Math.max(5, Math.round(dreamChanceScore(strength, s) * penalty))]
    }))

    const studentSummary = buildStudentSummary({ name, country, grade, testScores, extracurriculars, honors, essay, personality, majors, efc })
    const regularSchoolList = regularPool.map(compressSchool).join('\n---\n')
    const dreamSchoolList = dreamPool
      .map(s => {
        const penalized = dreamFinancialPenalty(efc, finById[s.id]) < 1
        return `${compressSchool(s)}\nChance score: ${dreamChance.get(s.id)}/100 (computed — your narrative must be consistent with this number)${penalized
          ? `\nFinancial reality: this school's typical aid falls short of this family's need (EFC bracket ${efcLabel(efc)}) — the chance score is already discounted for it; address affordability honestly in the narrative and concerns.`
          : ''}`
      })
      .join('\n---\n')

    const systemPrompt = `You are a senior college admissions counselor at Freshman Academy, specializing in placing international students at US universities. You have deep knowledge of each school's culture, academics, and what truly makes a student thrive there. Be specific and honest — vague praise wastes everyone's time.`

    // Build a lookup for post-AI validation — name comes from our data, not the model
    const eligibleMap = new Map(pool.map(s => [s.id, s]))
    const dreamMap = new Map(dreamPool.map(s => [s.id, s]))
    // Allow all schools (regular + dream) in the response
    const allAllowed = new Map([...eligibleMap, ...dreamMap])

    const dreamSection = dreamPool.length > 0 ? `
Dream schools the student specifically wants evaluated (evaluate ALL of them regardless of fit):
${dreamSchoolList}

` : ''

    const regularSection = regularPool.length > 0 ? `Pick the 10–12 best matches from the ${regularPool.length} eligible schools below. ONLY use schools from this list.

Schools:

${regularSchoolList}` : 'No regular eligible schools.'

    const userMessage = `Student profile:

${studentSummary}
${dreamSection}
${regularSection}

Also classify this student into ONE "personalityType" — the single academic identity that best captures who they are as an applicant, judged from their essay, extracurriculars, honors, intended majors, and any personality-quiz answers above. Choose exactly one key:
- "engineer" — hands-on builders: robotics, mechanical/civil/electrical, making physical things
- "programming" — software, computer science, competitive coding, anything code-first
- "scientist" — physics, biology, chemistry, math, lab research and discovery
- "environmentalist" — sustainability, climate, ecology, conservation
- "business" — entrepreneurship, finance, economics, management, founding ventures
- "social-scientist" — psychology, sociology, political science, how people and societies work
- "humanitarian" — philosophy, ethics, public service, human rights, the life of the mind
- "artistic" — music, visual art, design, creative writing, film, performance
Pick the dominant one even if the student spans several; do not invent other values.

For each school return:
- "id": the id before the | on each line
- "name": school name
- "fitScore": integer 0–100
- "narrative": 2–3 sentences — WHY this student fits or doesn't fit this school specifically, not generic praise
- "matchReasons": 2–3 short strings
- "concerns": 1–2 short strings

Scoring rules:
- "schools" fitScore = overall fit (academic, cultural, programmatic match). These schools already passed an academic + financial eligibility filter — do NOT let admit rate alone drag the score down; weight genuine fit.
${majors?.length ? `- The student's desired majors matter heavily: a school strong in those programs should score meaningfully higher than an otherwise-similar school that is weak in them, and every narrative should say how the school serves (or fails) the intended major.\n` : ''}
- Calibrate "schools" fitScores against these bands: 88–95 exceptional all-around match, 78–87 strong match, 68–77 solid match with a gap or two, below 68 only for a genuine mismatch. Spread scores across the list — do not cluster.
${dreamPool.length > 0 ? `- Dream schools get a fitScore too — same fit semantics and bands as "schools" (how well the school matches this student; do not deflate it for selectivity). Each dream school also shows a precomputed "Chance score: X/100" — their realistic admission odds, already final. Do NOT return the chance as fitScore and do NOT average the two. Write each dream narrative consistent with BOTH numbers: why the school fits or doesn't, and what drives their odds.\n` : ''}- "Avg aid: $X/yr" figures are this family's actual aid eligibility from our database. Treat them as ground truth — do not raise financial-fit concerns that contradict them.

Return exactly this JSON, in this key order:
{
  "personalityType": "one of the keys above",
  "dreamSchools": [...],  // ALL dream schools evaluated, sorted by fitScore desc${dreamPool.length === 0 ? ' — empty array, student listed none' : ''}
  "schools": [...]        // 10–12 best regular matches, sorted by fitScore desc
}
No markdown, no extra keys. Output "personalityType" first, then generate "dreamSchools" completely before starting "schools".`

    const raw = await chat(
      [{ role: 'user', content: userMessage }],
      { systemPrompt, max_tokens: 8000, response_format: { type: 'json_object' } }
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

    // Hard guard — two passes per array:
    // 1. Discard any school whose id wasn't in the allowed list
    // 2. Overwrite name with our authoritative value (immune to AI misspellings)
    const aiSchools = parsed.schools || []
    const aiDreamSchools = parsed.dreamSchools || []

    // Reserve 'true-freshman' — criteria still TBD, so the model is never asked for it.
    const ALLOWED_TYPES = new Set([
      'engineer', 'programming', 'scientist', 'environmentalist',
      'business', 'social-scientist', 'humanitarian', 'artistic',
    ])
    const personalityType = ALLOWED_TYPES.has(parsed.personalityType) ? parsed.personalityType : null

    const byFitScoreDesc = (a, b) => (b.fitScore ?? 0) - (a.fitScore ?? 0)

    const results = aiSchools
      .filter(s => allAllowed.has(s.id) && !dreamIdSet.has(s.id))  // dream schools render in their own row
      .map(s => ({ ...s, name: allAllowed.get(s.id).name }))
      .sort(byFitScoreDesc)
      .slice(0, 12)

    // fitScore = model's fit judgment (same bands as regular schools);
    // chance = OUR deterministic admission odds — never the model's, kills run-to-run drift
    const byChanceDesc = (a, b) => (b.chance ?? 0) - (a.chance ?? 0)
    const dreamResults = aiDreamSchools
      .filter(s => dreamMap.has(s.id))
      .map(s => ({
        ...s,
        name: dreamMap.get(s.id).name,
        fitScore: Number.isFinite(s.fitScore) ? Math.round(s.fitScore) : dreamChance.get(s.id),
        chance: dreamChance.get(s.id),
      }))
      .sort(byChanceDesc)
      .slice(0, 3)

    // Backfill any dream school the model dropped so all requested schools always render
    for (const school of dreamPool) {
      if (dreamResults.find(d => d.id === school.id)) continue
      const chance = dreamChance.get(school.id)
      dreamResults.push({
        id: school.id,
        name: school.name,
        fitScore: chance,
        chance,
        narrative: chance >= 70
          ? `${school.name} is within realistic reach for this profile — the academics put this student in the competitive band of admitted applicants.`
          : chance >= 45
            ? `${school.name} is a genuine reach but not out of range for this profile — execution on essays and positioning will decide it.`
            : `${school.name} is a long shot for this profile given its selectivity — worth applying only alongside a balanced list.`,
        matchReasons: [],
        concerns: [],
      })
    }
    dreamResults.sort(byChanceDesc)

    const payload = { personalityType, schools: results, dreamSchools: dreamResults }
    if (responseCache.size >= CACHE_MAX) responseCache.delete(responseCache.keys().next().value)
    responseCache.set(cacheKey, payload)
    saveSubmission(req.body, payload)  // fire-and-forget; one row per fresh computation
    settleInflight?.resolve(payload)
    inflight.delete(cacheKey)
    res.json(payload)
  } catch (err) {
    settleInflight?.reject(err)
    if (cacheKey) inflight.delete(cacheKey)
    console.error('/api/narrate error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
