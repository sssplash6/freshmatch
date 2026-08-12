// Deterministic scoring & eligibility — the pure core of the product.
//
// Every number a student sees (strength composite, admission chance, financial
// penalty) comes from the functions in this file, never from the model. They
// are shared by the match pipeline (routes/narrate.js) and the Per-College
// Report engine (server/report/*), which re-runs them on mutated profiles to
// simulate counterfactuals — so everything here must stay pure: no I/O, no
// randomness, no clocks.

// EFC → minimum avg aid required
export const EFC_BRACKETS = [
  { max: 15000,  minAid: 70000 },
  { max: 25000,  minAid: 55000 },
  { max: 40000,  minAid: 40000 },
  { max: 60000,  minAid: 25000 },
  { max: 80000,  minAid: 10000 },
  { max: Infinity, minAid: 0   },
]
export const BUFFER = 0.20

// Need-blind campuses: financial filter never applies, always eligible.
// duke: Karsh International Scholarship covers full cost for 35 recipients — merit only, EFC irrelevant.
export const NEED_BLIND_IDS = new Set(['nyuad', 'cmu-q', 'gu-q', 'duke'])

// Minimum EFC required (school has its own aid structure, not need-blind).
// nyush/dku: families must have some contribution capacity to cover remaining costs.
export const EFC_MIN = {
  'nyush': 15001,
  'dku':   15001,
}

// School-specific minimum SAT score — hard gate regardless of composite strength.
// colby: college policy requires SAT ≥ 1540 for international applicants.
export const SAT_MINIMUMS = {
  'colby': 1540,
}

// School-specific composite strength floor — overrides tier-based gate.
// duke: Karsh is ivy-level competition; only surface to students who can realistically compete.
export const STRENGTH_FLOORS = {
  'duke': 76,
}

// Aspirational US campuses: only surface to EFC > $60k students.
// Georgetown/NYU give generous aid but their cost structure and US-specific benefits
// make them appropriate only once family contribution capacity is substantial.
export const EFC_FLOOR = {
  'georgetown': 60001,
  'nyu':        60001,
}

// Branch campus → parent school id for Fiske fit profile lookup.
// NYUAD and NYUSH have their own Fiske profiles; cmu-q and gu-q share parent profiles.
export const FIT_PROXY = {
  'cmu-q': 'carnegie-mellon',
  'gu-q':  'georgetown',
}

// Reject junk / low-effort free text ("Jjj", "H", "B") that the client-side
// validation normally blocks — defense in depth so a bypassed submission can't
// inflate strength or pollute the AI prompt. Mirrors src/utils/validation.js.
export function hasSubstance(value, minChars = 3) {
  const s = (value || '').trim()
  if (s.length < minChars) return false
  return new Set(s.replace(/\s+/g, '').toLowerCase()).size >= 2
}

// High-precision keyboard-mash marker: 3+ of the same letter in a row ("biii",
// "wentttt", "aaaa"). Triple letters essentially never occur in real spelling,
// so this is safe against genuine non-native English and typos — it only strips
// the most obvious junk from the strength tally. The AI dataQuality gate does the
// nuanced judgement (jokes, nonsense, mashed phrasing) that a regex can't.
export const looksMashed = value => /([a-z])\1\1/i.test(value || '')

// Whole-entry placeholder / "I have nothing" text. It's grammatical English so
// hasSubstance/looksMashed let it through, but it carries no content — the student
// is effectively leaving the field blank ("I dont have anything", "none", "n/a").
// Must not count as a real activity/honor or inflate the strength score.
const NO_CONTENT_RE = /^(i\s*(do\s*n'?t|don'?t|dont)\s*(have|got)\s*(any(thing)?|much|stuff)?|i\s*have\s*(nothing|none|no\b.*)|nothing|none|no\s+(activit|honou?r|award|idea)\w*|n\.?\s*\/?\s*a\.?|na|idk|i\s*don'?t\s*know|nope?|nil|null|empty|-+|\.+)\.?$/i
export const isNoContentText = v => NO_CONTENT_RE.test((v || '').trim())

export const isRealHonor = h => hasSubstance(h?.title, 3) && !looksMashed(h?.title) && !isNoContentText(h?.title)
export const isRealEc    = e => hasSubstance(e?.description, 12) && !looksMashed(e?.description) && !isNoContentText(e?.description)

// Is there ANY genuine anchor to assess fit from? A real profile has at least one
// of: a usable test score, a real honor, a real activity, or a real essay. Floor
// scores (SAT 400, GPA 0–1/100, IELTS 3.5) and all-placeholder activities carry no
// signal — without any anchor, the personality quiz alone can't judge college fit,
// so we bail with "insufficient" (and skip the LLM call entirely).
export function hasAssessableSignal({ testScores, honors, extracurriculars, essay }) {
  const sat   = parseInt(testScores?.sat) || 0
  const gpa   = parseFloat(testScores?.gpa)
  const scale = parseFloat(testScores?.gpaScale) || 4
  const ielts = parseFloat(testScores?.ielts)

  const usableSat   = sat >= 800 && sat <= 1600
  const usableGpa   = gpa > 0 && scale > 0 && gpa <= scale && (gpa / scale) * 4 >= 1.0
  const usableIelts = Number.isFinite(ielts) && ielts >= 5 && ielts <= 9
  const otherExams  = !!(testScores?.alevels || testScores?.ib || testScores?.ap)
  const realHonor   = (honors || []).some(isRealHonor)
  const realEc      = (extracurriculars || []).some(isRealEc)
  const realEssay   = (essay || '').trim().length >= 80

  return usableSat || usableGpa || usableIelts || otherExams || realHonor || realEc || realEssay
}

// GPA normalized to a /4 scale, or null when absent/invalid. Shared by the
// strength composite and the report engine's benchmark comparisons.
export function normalizedGpa(testScores) {
  const gpa   = parseFloat(testScores?.gpa)
  const scale = parseFloat(testScores?.gpaScale) || 4
  if (!(gpa > 0) || !(scale > 0) || gpa > scale) return null
  return (gpa / scale) * 4
}

// Composite academic strength score (0–100) across SAT, GPA, honors, and ECs.
// Honors level can compensate for a lower SAT — an olympiad winner with 1480 should
// still reach elite schools; a 1470 with zero achievements should not.
export function academicStrength(testScores, honors, extracurriculars) {
  let score = 0

  // SAT (0–40). Ignore impossible values (e.g. 9999) so they can't inflate.
  const satRaw = parseInt(testScores?.sat) || 0
  const sat = satRaw >= 400 && satRaw <= 1600 ? satRaw : 0
  score += sat >= 1580 ? 40 : sat >= 1550 ? 34 : sat >= 1520 ? 28 :
           sat >= 1490 ? 22 : sat >= 1460 ? 16 : sat >= 1420 ? 10 :
           sat >= 1380 ?  5 : 0

  // GPA normalized to /4 scale (0–20). Ignore GPAs above their own scale.
  const norm = normalizedGpa(testScores)
  if (norm !== null) {
    score += norm >= 3.9 ? 20 : norm >= 3.7 ? 15 : norm >= 3.5 ? 10 : norm >= 3.0 ? 5 : 0
  }

  // Honors (0–30, capped) — higher level awards carry much more weight
  const honorPts = { intl: 15, natl: 10, regional: 5, school: 2 }
  const honorsTotal = (honors || [])
    .filter(isRealHonor)
    .reduce((sum, h) => sum + (honorPts[h.level] || 0), 0)
  score += Math.min(honorsTotal, 30)

  // ECs (0–10)
  const filledEcs = (extracurriculars || []).filter(isRealEc).length
  score += Math.min(Math.round(filledEcs * 1.5), 10)

  return score  // max ~100
}

// A clearly strong AND substantive profile: real top scores/GPA plus genuine
// national/international honors or a full slate of real activities. These are
// exactly the high-achievers the AI authenticity gates occasionally misread as
// "too good to be true" / "fabricated" and block. We skip BOTH gates for them
// entirely — a troll can't cheaply fake this combination (strength requires
// bounded, real-looking scores, and the honor/EC filters strip junk), and even
// if one somehow did, elite scores simply yield elite matches, so there is no
// harm. This is a deterministic bypass: no model can flag what it never sees.
export function isHighProfile(strength, honors, extracurriculars) {
  const topHonors = (honors || [])
    .filter(isRealHonor)
    .filter(h => h.level === 'intl' || h.level === 'natl').length
  const realEcs = (extracurriculars || []).filter(isRealEc).length
  // Junk profiles score ≤~16 (no real scores); genuine high-achievers clear 50
  // comfortably. The honor/activity requirement keeps a bare scores-only profile
  // (which the gate SHOULD still see) from bypassing.
  return strength >= 50 && (topHonors >= 1 || realEcs >= 5)
}

// Minimum composite strength required per admit-rate tier
export const ACADEMIC_GATES = [
  { maxRate: 5,  minStrength: 76 },  // MIT, Stanford, Harvard, Yale, NYUAD
  { maxRate: 10, minStrength: 58 },  // Princeton, Brown, Dartmouth, Duke, Cornell
  { maxRate: 15, minStrength: 44 },  // Columbia, JHU, Northwestern, Vanderbilt
  { maxRate: 20, minStrength: 32 },  // Pomona, Swarthmore, Williams, Amherst
]

// Fiske data errors and gaps — correct wrong admit rates, fill nulls.
// Without a rate a school bypasses the academic gate AND gets the generic
// dream-chance fallback, so selective schools here would be badly mis-scored.
export const ADMIT_RATE_OVERRIDES = {
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

// Effective admit rate used by the chance curve and gates, or null when the
// school has no usable rate anywhere (overrides win over Fiske stats).
export function admitRate(school) {
  const raw = ADMIT_RATE_OVERRIDES[school.id] ?? parseFloat(school.stats?.accepted)
  return isNaN(raw) ? null : raw
}

// Deterministic admission-chance score for dream schools (0–100).
// Computed from our strength composite + admit rate so repeat runs return
// IDENTICAL numbers — the AI writes the narrative around this value, it does
// not choose it. Tune the curve here, not in the prompt.
export const DREAM_RATE_FALLBACK = 15  // dream school missing admit-rate data
export function dreamChanceScore(strength, school) {
  const raw = admitRate(school)
  const rate = raw === null ? DREAM_RATE_FALLBACK : Math.min(Math.max(raw, 2), 60)
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
export function dreamFinancialPenalty(efc, fin) {
  if (!fin) return 1                              // no financial data — don't guess
  if (isFinanciallyEligible(efc, fin)) return 1   // aid covers this bracket
  if (fin.noAid || fin.avgAid == null) return 0.4 // can't realistically fund attendance
  const minAid = EFC_BRACKETS.find(b => efc <= b.max).minAid
  if (minAid <= 0) return 1
  const coverage = fin.avgAid / minAid            // eligibility passes at ≥ 0.8 (BUFFER)
  // coverage 0.8 → 1.0 (continuous with the eligible case), 0 → 0.4 floor
  return Math.max(0.4, Math.min(1, 0.4 + coverage * 0.75))
}

export function isAcademicallyEligible(strength, school, testScores) {
  // Hard SAT floor for specific schools
  const satMin = SAT_MINIMUMS[school.id]
  if (satMin !== undefined && (parseInt(testScores?.sat) || 0) < satMin) return false

  // School-specific strength floor (takes precedence over tier-based gate)
  const floor = STRENGTH_FLOORS[school.id]
  if (floor !== undefined) return strength >= floor

  const rate = admitRate(school)
  if (rate === null) return true
  const gate = ACADEMIC_GATES.find(g => rate <= g.maxRate)
  return gate ? strength >= gate.minStrength : true
}

export function isFinanciallyEligible(efc, school) {
  if (NEED_BLIND_IDS.has(school.id)) return true
  if (EFC_MIN[school.id] !== undefined) return efc >= EFC_MIN[school.id]
  if (EFC_FLOOR[school.id] && efc < EFC_FLOOR[school.id]) return false
  if (school.noAid) return efc > 80000
  if (school.avgAid === null) return false
  const bracket = EFC_BRACKETS.find(b => efc <= b.max)
  return school.avgAid >= bracket.minAid * (1 - BUFFER)
}

export function efcLabel(efc) {
  if (efc <= 15000) return '$0–$15k'
  if (efc <= 25000) return '$15–$25k'
  if (efc <= 40000) return '$25–$40k'
  if (efc <= 60000) return '$40–$60k'
  if (efc <= 80000) return '$60–$80k'
  return '$80k+'
}

// Does any of the student's desired majors line up with a school's strong programs?
export function majorMatches(majors, school) {
  if (!majors?.length) return false
  const progs = (school.strongPrograms || []).map(p => p.toLowerCase())
  return majors.some(m => {
    const ml = m.toLowerCase()
    return progs.some(p => p.includes(ml) || ml.includes(p))
  })
}
