// The Gap Vector — the Per-College Report's spine.
//
// For one (student, college) pair, a fully deterministic, structured account of
// where the student stands against that school's admitted-student profile,
// dimension by dimension. No model involvement: same input → same vector, byte
// for byte. It feeds the improvement engine, renders as the report's Standing
// and Deciding Factors sections, and ships as standalone JSON for partners.
//
// Benchmarks come from schools-admissions.json where published; a null
// benchmark degrades the dimension to an admit-rate-tier expectation or drops
// it entirely — a missing number is never invented.
import {
  academicStrength, normalizedGpa, admitRate,
  dreamChanceScore, dreamFinancialPenalty,
  isRealHonor, isRealEc, majorMatches, efcLabel,
  EFC_BRACKETS, NEED_BLIND_IDS, EFC_MIN, SAT_MINIMUMS, STRENGTH_FLOORS, EFC_FLOOR,
} from '../scoring.js'
import { ENGINE_VERSION } from './version.js'

// ── deterministic profile readers ────────────────────────────────────────────

const usableSat = testScores => {
  const sat = parseInt(testScores?.sat) || 0
  return sat >= 400 && sat <= 1600 ? sat : null
}

const HONOR_RANKS = { school: 1, regional: 2, natl: 3, intl: 4 }
const HONOR_LABELS = { 0: 'None', 1: 'School', 2: 'Regional', 3: 'National', 4: 'International' }

function honorCeiling(honors) {
  return (honors || [])
    .filter(isRealHonor)
    .reduce((max, h) => Math.max(max, HONOR_RANKS[h.level] || 0), 0)
}

// Split a free-text exam field ("Math A*, Physics A, CS B") into entry count.
const countEntries = text => String(text || '')
  .split(/[,;\n/]+/)
  .map(s => s.trim())
  .filter(s => s.length >= 2).length

// Advanced-curriculum load in rough "course units". IB is a whole diploma
// programme, so its presence counts as a multi-course load on its own.
export function rigorUnits(testScores) {
  const alevels = countEntries(testScores?.alevels)
  const ap = countEntries(testScores?.ap)
  let ib = 0
  if (testScores?.ib != null && String(testScores.ib).trim()) {
    const score = parseFloat(testScores.ib)
    ib = Number.isFinite(score) ? (score >= 38 ? 4 : score >= 30 ? 3 : 2) : 3
  }
  return alevels + ap + ib
}

// Depth markers detected in activity free text. Deliberately generous regexes —
// they only ever work in the student's favor, and the LLM never re-judges them.
const LEADERSHIP_RE = /\b(found(?:ed|er)|co-?found|president|vice-?president|captain|led|leads?|leader|head(?:ed)?|chair|director|organi[sz](?:ed|er)|launch(?:ed)?|started|created|manag(?:ed|er)|coach(?:ed)?|mentor(?:ed)?|taught|teach)\b/i
const ARTIFACT_RE = /\b(github|gitlab|app|website|web-?site|url|http|published|paper|research|built|shipped|prototype|robot|olympiad|hackathon|competition|startup|patent|channel|podcast|portfolio)\b/i
const SCALE_RE = /\b(\d{2,}\+?\s*(?:people|students|members|users|views|followers|subscribers|participants|children|kids)|raised|fundrais|donat|national|international|regional|city-?wide)\b/i
const DURATION_RE = /\b(\d+\s*(?:years?|yrs?)|since\s+20\d\d)\b/i

export function ecProfile(extracurriculars) {
  const real = (extracurriculars || []).filter(isRealEc)
  let deep = 0, withLeadership = 0, withArtifact = 0
  for (const e of real) {
    const text = e.description || ''
    const leadership = LEADERSHIP_RE.test(text)
    const artifact = ARTIFACT_RE.test(text)
    const markers = leadership + artifact + SCALE_RE.test(text) + DURATION_RE.test(text)
    if (leadership) withLeadership++
    if (artifact) withArtifact++
    if (markers >= 2) deep++
  }
  return { count: real.length, deep, withLeadership, withArtifact }
}

// ── admit-rate tier expectations ──────────────────────────────────────────────
// What the admitted pool typically looks like at each selectivity band. Used
// wherever a school-published benchmark is unavailable. Rate null (unknown) is
// treated as a moderately selective school rather than an open door.

function tier(rate) {
  const r = rate ?? 25
  if (r <= 5) return 0
  if (r <= 10) return 1
  if (r <= 20) return 2
  if (r <= 35) return 3
  if (r <= 55) return 4
  return 5
}

const EXPECT = {
  gpaNorm:      [3.9, 3.85, 3.75, 3.6, 3.4, 3.0],
  rigorUnits:   [4, 3, 3, 2, 1, 0],
  honorCeiling: [3, 3, 2, 2, 1, 0],
  ecDeep:       [2, 2, 1, 1, 0, 0],
  ecCount:      [5, 4, 3, 3, 2, 1],
}

// ── percentile placement ─────────────────────────────────────────────────────
// Piecewise-linear through (p25,25) (p50,50) (p75,75); below p25 the curve runs
// to an implied floor two IQRs down, above p75 to the score ceiling. Clamped to
// [1,99] — we never claim 0 or 100 from three anchor points.
export function satPercentile(sat, bands, ceiling = 1600) {
  if (!bands || bands.p25 == null || bands.p50 == null || bands.p75 == null) return null
  const { p25, p50, p75 } = bands
  const iqr = Math.max(p75 - p25, 10)
  let pct
  if (sat <= p25) {
    const floor = p25 - 2 * iqr
    pct = 25 * (sat - floor) / (p25 - floor)
  } else if (sat <= p50) {
    pct = 25 + 25 * (sat - p25) / Math.max(p50 - p25, 1)
  } else if (sat <= p75) {
    pct = 50 + 25 * (sat - p50) / Math.max(p75 - p50, 1)
  } else {
    pct = 75 + 25 * (sat - p75) / Math.max(ceiling - p75, 1)
  }
  return Math.round(Math.min(99, Math.max(1, pct)))
}

// ── dimension weighting (spec §5.2) ──────────────────────────────────────────
// Base profile by admit-rate tier: at ultra-selective schools honors and EC
// depth dominate testing (everyone has the scores); at moderate selectivity
// testing and GPA carry more. Adjusted for the school's academic intensity,
// the student's declared major, and any aid shortfall; then normalized to 1.

const BASE_WEIGHTS = [
  { testing: 0.14, gpa: 0.10, rigor: 0.10, honors: 0.22, ecDepth: 0.18, ecBreadth: 0.06, programAlignment: 0.10, characterFit: 0.06, financialFeasibility: 0.04 },
  { testing: 0.16, gpa: 0.12, rigor: 0.10, honors: 0.18, ecDepth: 0.16, ecBreadth: 0.06, programAlignment: 0.10, characterFit: 0.06, financialFeasibility: 0.06 },
  { testing: 0.20, gpa: 0.16, rigor: 0.10, honors: 0.12, ecDepth: 0.12, ecBreadth: 0.08, programAlignment: 0.10, characterFit: 0.06, financialFeasibility: 0.06 },
  { testing: 0.22, gpa: 0.18, rigor: 0.08, honors: 0.08, ecDepth: 0.10, ecBreadth: 0.08, programAlignment: 0.12, characterFit: 0.06, financialFeasibility: 0.08 },
  { testing: 0.22, gpa: 0.20, rigor: 0.06, honors: 0.06, ecDepth: 0.08, ecBreadth: 0.08, programAlignment: 0.14, characterFit: 0.06, financialFeasibility: 0.10 },
  { testing: 0.20, gpa: 0.20, rigor: 0.05, honors: 0.05, ecDepth: 0.08, ecBreadth: 0.08, programAlignment: 0.16, characterFit: 0.06, financialFeasibility: 0.12 },
]

// ── the gap vector ───────────────────────────────────────────────────────────

// profile: the raw submission body shape ({ testScores, honors,
// extracurriculars, majors, efc, grade, ... }).
// resolved: resolveCollege() output ({ school, fin, admissions }).
// opts.fitScore: the model-judged, band-calibrated fit score from a match run,
// when the caller has one — it powers the characterFit dimension. Passing it
// keeps this function itself model-free and pure.
export function buildGapVector(profile, { school, fin, admissions }, { fitScore = null } = {}) {
  const { testScores, honors, extracurriculars, majors, efc } = profile
  const strength = academicStrength(testScores, honors, extracurriculars)
  const penalty = dreamFinancialPenalty(efc, fin)
  const chance = Math.max(5, Math.round(dreamChanceScore(strength, school) * penalty))
  const rate = admitRate(school)
  const t = tier(rate)

  const dimensions = []

  // — testing —
  const sat = usableSat(testScores)
  const policy = admissions?.testPolicy ?? null
  const bands = admissions?.sat ?? null
  if (policy !== 'blind') {
    if (sat !== null && bands) {
      const delta = sat - bands.p25
      const percentile = satPercentile(sat, bands)
      dimensions.push({
        key: 'testing', label: 'Standardized testing',
        status: sat >= bands.p75 ? 'surplus' : sat >= bands.p25 ? 'at-par' : sat >= bands.p25 - 60 ? 'shortfall' : 'critical',
        studentValue: sat,
        benchmark: { p25: bands.p25, p50: bands.p50, p75: bands.p75 },
        delta, percentile,
        evidence: `SAT ${sat} vs admitted P25 of ${bands.p25} (median ${bands.p50})`,
        leverage: 'high',
      })
    } else if (sat !== null) {
      // No published bands — tier expectation keeps the dimension qualitative.
      const expected = [1520, 1480, 1420, 1350, 1250, 1150][t]
      dimensions.push({
        key: 'testing', label: 'Standardized testing',
        status: sat >= expected + 60 ? 'surplus' : sat >= expected ? 'at-par' : sat >= expected - 80 ? 'shortfall' : 'critical',
        studentValue: sat, benchmark: null, delta: null, percentile: null,
        evidence: `SAT ${sat}; no published admitted-score bands for this school — assessed against its selectivity tier`,
        leverage: 'high',
      })
    } else if (policy === 'required') {
      dimensions.push({
        key: 'testing', label: 'Standardized testing',
        status: 'critical',
        studentValue: null, benchmark: bands, delta: null, percentile: null,
        evidence: 'No SAT on file — this school requires a test score',
        leverage: 'high',
      })
    } else if (bands) {
      dimensions.push({
        key: 'testing', label: 'Standardized testing',
        status: 'shortfall',
        studentValue: null, benchmark: bands, delta: null, percentile: null,
        evidence: `No SAT on file — test-optional here, but international applicants typically strengthen their case by submitting near the admitted median (${bands.p50})`,
        leverage: 'high',
      })
    }
    // no score, no policy, no bands → nothing assessable; dimension omitted
  }

  // — gpa —
  const gpaNorm = normalizedGpa(testScores)
  if (gpaNorm !== null) {
    const benchmark = admissions?.gpa?.mean ?? null
    const expected = benchmark ?? EXPECT.gpaNorm[t]
    const diff = gpaNorm - expected
    const grade = profile.grade || ''
    dimensions.push({
      key: 'gpa', label: 'GPA',
      status: diff >= 0.1 ? 'surplus' : diff >= -0.05 ? 'at-par' : diff >= -0.3 ? 'shortfall' : 'critical',
      studentValue: Math.round(gpaNorm * 100) / 100,
      benchmark: { mean: expected, source: benchmark != null ? 'published' : 'tier-expectation' },
      delta: Math.round(diff * 100) / 100, percentile: null,
      evidence: `GPA ${testScores.gpa}/${testScores.gpaScale || 4} (~${(Math.round(gpaNorm * 100) / 100).toFixed(2)}/4) vs ${benchmark != null ? 'admitted average' : 'typical admitted profile'} of ${expected.toFixed(2)}`,
      // Seniors have no terms left to move a GPA; younger students do.
      leverage: /9th|10th|11th/i.test(grade) ? 'medium' : 'low',
    })
  }

  // — rigor —
  const units = rigorUnits(testScores)
  {
    const expected = EXPECT.rigorUnits[t]
    if (expected > 0 || units > 0) {
      const diff = units - expected
      dimensions.push({
        key: 'rigor', label: 'Curriculum rigor',
        status: diff >= 2 ? 'surplus' : diff >= 0 ? 'at-par' : diff >= -2 ? 'shortfall' : 'critical',
        studentValue: units, benchmark: { expectedUnits: expected }, delta: diff, percentile: null,
        evidence: units > 0
          ? `${units} advanced course unit${units === 1 ? '' : 's'} (A-Level/IB/AP) vs ~${expected} expected at this selectivity`
          : `No advanced curriculum entries on file (A-Level/IB/AP) — admitted students here typically carry ~${expected}`,
        leverage: 'medium',
      })
    }
  }

  // — honors —
  {
    const ceiling = honorCeiling(honors)
    const expected = EXPECT.honorCeiling[t]
    const diff = ceiling - expected
    dimensions.push({
      key: 'honors', label: 'Honors & awards',
      status: diff >= 1 ? 'surplus' : diff >= 0 ? 'at-par' : diff >= -1 ? 'shortfall' : 'critical',
      studentValue: HONOR_LABELS[ceiling], benchmark: { expectedCeiling: HONOR_LABELS[expected] },
      delta: diff, percentile: null,
      evidence: ceiling > 0
        ? `Highest honor level: ${HONOR_LABELS[ceiling].toLowerCase()} — the admitted pool here typically peaks at ${HONOR_LABELS[expected].toLowerCase()}${t <= 1 ? ' or above' : ''}`
        : `No honors on file — the admitted pool here typically carries ${HONOR_LABELS[expected].toLowerCase()}-level recognition`,
      leverage: 'medium',
    })
  }

  // — EC depth & breadth —
  const ecs = ecProfile(extracurriculars)
  {
    const expected = EXPECT.ecDeep[t]
    const diff = ecs.deep - expected
    dimensions.push({
      key: 'ecDepth', label: 'Activity depth',
      status: diff >= 1 ? 'surplus' : diff >= 0 ? 'at-par' : diff >= -1 ? 'shortfall' : 'critical',
      studentValue: { deep: ecs.deep, withLeadership: ecs.withLeadership, withArtifact: ecs.withArtifact },
      benchmark: { expectedDeep: expected }, delta: diff, percentile: null,
      evidence: `${ecs.count} activit${ecs.count === 1 ? 'y' : 'ies'}, ${ecs.deep} with real depth markers (leadership/artifact/scale/duration) vs ~${expected} expected`,
      leverage: 'high',
    })
    const expectedCount = EXPECT.ecCount[t]
    const cdiff = ecs.count - expectedCount
    dimensions.push({
      key: 'ecBreadth', label: 'Activity breadth',
      status: cdiff >= 2 ? 'surplus' : cdiff >= 0 ? 'at-par' : cdiff >= -2 ? 'shortfall' : 'critical',
      studentValue: ecs.count, benchmark: { expectedCount }, delta: cdiff, percentile: null,
      evidence: `${ecs.count} genuine activit${ecs.count === 1 ? 'y' : 'ies'} listed vs ~${expectedCount} typical here`,
      leverage: 'high',
    })
  }

  // — program alignment —
  const declaredMajors = (majors || []).filter(Boolean)
  if (declaredMajors.length) {
    const progs = school.strongPrograms || []
    const matched = declaredMajors.filter(m => majorMatches([m], school))
    const topProgs = progs.slice(0, 3).map(p => p.toLowerCase())
    const inTop = matched.some(m => topProgs.some(p => p.includes(m.toLowerCase()) || m.toLowerCase().includes(p)))
    dimensions.push({
      key: 'programAlignment', label: 'Program alignment',
      status: inTop ? 'surplus' : matched.length ? 'at-par' : progs.length ? 'shortfall' : 'at-par',
      studentValue: declaredMajors, benchmark: progs.slice(0, 5),
      delta: matched.length, percentile: null,
      evidence: matched.length
        ? `${matched.join(', ')} line${matched.length === 1 ? 's' : ''} up with this school's strong programs${inTop ? ' — including its flagship offerings' : ''}`
        : progs.length
          ? `None of the intended majors (${declaredMajors.join(', ')}) appear among this school's documented strengths`
          : 'No documented program-strength data for this school',
      leverage: 'medium',
    })
  }

  // — character fit (band-locked model judgment from the match run, if any) —
  if (Number.isFinite(fitScore)) {
    dimensions.push({
      key: 'characterFit', label: 'Culture & character fit',
      status: fitScore >= 88 ? 'surplus' : fitScore >= 78 ? 'at-par' : fitScore >= 68 ? 'shortfall' : 'critical',
      studentValue: Math.round(fitScore), benchmark: { bands: '88+ exceptional / 78–87 strong / 68–77 solid / <68 mismatch' },
      delta: null, percentile: null,
      evidence: `Fit score ${Math.round(fitScore)}/100 from the match evaluation`,
      leverage: 'low',
    })
  }

  // — financial feasibility —
  const bracket = EFC_BRACKETS.find(b => efc <= b.max)
  const minAid = bracket.minAid
  const needBlind = NEED_BLIND_IDS.has(school.id)
  const finEligible = fin ? (needBlind || penalty === 1) : null
  const coverage = needBlind || minAid === 0 ? 1
    : fin?.avgAid != null ? Math.round((fin.avgAid / minAid) * 100) / 100
    : null
  {
    const status = needBlind ? 'surplus'
      : finEligible === null ? 'at-par'
      : finEligible ? 'at-par'
      : coverage !== null && coverage >= 0.5 ? 'shortfall'
      : 'critical'
    dimensions.push({
      key: 'financialFeasibility', label: 'Financial feasibility',
      status,
      studentValue: efcLabel(efc),
      benchmark: needBlind
        ? { policy: 'need-blind for international applicants' }
        : { avgAid: fin?.avgAid ?? null, minAidForBracket: minAid },
      delta: null, percentile: null, coverage,
      evidence: needBlind
        ? 'Need-blind for international applicants — family finances play no role in the admission decision'
        : finEligible === null ? 'No financial data on file for this school — affordability unassessed'
        : finEligible ? `Typical aid (${fin.avgAid != null ? `$${Math.round(fin.avgAid).toLocaleString()}/yr` : 'per policy'}) covers this family's need bracket (${efcLabel(efc)})`
        : fin.noAid || fin.avgAid == null
          ? 'This school offers no need-based aid this profile can draw on — attendance would be full-cost'
          : `Typical aid $${Math.round(fin.avgAid).toLocaleString()}/yr covers ~${Math.round(coverage * 100)}% of this bracket's need — the shortfall also weighs on admission odds at need-aware schools`,
      leverage: 'low',
    })
  }

  // — hard institutional gates —
  const satMin = SAT_MINIMUMS[school.id]
  const strengthFloor = STRENGTH_FLOORS[school.id]
  const efcMin = EFC_MIN[school.id]
  const efcFloor = EFC_FLOOR[school.id]
  const gates = {
    satMinimum: satMin !== undefined
      ? { applies: true, required: satMin, met: (parseInt(testScores?.sat) || 0) >= satMin }
      : { applies: false },
    strengthFloor: strengthFloor !== undefined
      ? { applies: true, required: strengthFloor, met: strength >= strengthFloor }
      : { applies: false },
    efcMinimum: efcMin !== undefined
      ? { applies: true, required: efcMin, met: efc >= efcMin }
      : { applies: false },
    efcFloor: efcFloor !== undefined
      ? { applies: true, required: efcFloor, met: efc >= efcFloor }
      : { applies: false },
    needBlind: { applies: needBlind },
    financialFilter: { passed: finEligible, coverage },
  }
  const failedGates = [
    !gates.satMinimum.met && gates.satMinimum.applies && `SAT minimum ${satMin} not met`,
    !gates.strengthFloor.met && gates.strengthFloor.applies && `composite strength floor ${strengthFloor} not met`,
    !gates.efcMinimum.met && gates.efcMinimum.applies && 'family contribution below this campus\'s minimum',
    !gates.efcFloor.met && gates.efcFloor.applies && 'family contribution below the bracket this campus realistically serves',
  ].filter(Boolean)
  if (failedGates.length) {
    dimensions.push({
      key: 'institutionalGates', label: 'Institutional requirements',
      status: 'critical',
      studentValue: null, benchmark: null, delta: null, percentile: null,
      evidence: `Hard requirement${failedGates.length === 1 ? '' : 's'} not met: ${failedGates.join('; ')}`,
      leverage: gates.satMinimum.applies && !gates.satMinimum.met ? 'high' : 'low',
    })
  }

  // — weights: tier base, school/profile adjustments, renormalize over present dims —
  const w = { ...BASE_WEIGHTS[t], institutionalGates: failedGates.length ? 0.08 : 0 }
  if (school.ratings?.academics === 5) w.rigor += 0.04
  if (declaredMajors.length) w.programAlignment += majorMatches(declaredMajors, school) ? 0.05 : 0.03
  if (coverage !== null && coverage < 1 && !needBlind) w.financialFeasibility += (1 - Math.max(coverage, 0)) * 0.15
  const present = new Set(dimensions.map(d => d.key))
  const total = [...present].reduce((sum, k) => sum + (w[k] || 0), 0)
  for (const d of dimensions) d.weight = Math.round(((w[d.key] || 0) / total) * 1000) / 1000
  // Dump rounding drift on the heaviest dimension so weights sum to exactly 1.
  const drift = Math.round((1 - dimensions.reduce((s, d) => s + d.weight, 0)) * 1000) / 1000
  if (drift !== 0 && dimensions.length) {
    const heaviest = dimensions.reduce((a, b) => (b.weight > a.weight ? b : a))
    heaviest.weight = Math.round((heaviest.weight + drift) * 1000) / 1000
  }
  dimensions.sort((a, b) => b.weight - a.weight)

  return {
    collegeId: school.id,
    collegeName: school.name,
    engineVersion: ENGINE_VERSION,
    strength,
    chance,
    fitScore: Number.isFinite(fitScore) ? Math.round(fitScore) : null,
    admitRate: rate,
    financialPenalty: Math.round(penalty * 100) / 100,
    dimensions,
    gates,
    benchmark: admissions
      ? { confidence: admissions.confidence, asOf: admissions.asOf, sources: admissions.sources, testPolicy: admissions.testPolicy }
      : null,
  }
}
