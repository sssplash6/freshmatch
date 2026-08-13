// The improvement plan: rule catalogue → counterfactual simulation → ROI
// ranking → feasibility split → composite scenarios.
//
// Deterministic end to end for a given `now` (injected by the caller and
// frozen into the cached report, so a cached PDF never shifts under a reader).
// The model is not involved anywhere in this file.
import { matchRules, ceilingPrescription } from './rules.js'
import { simulate, chanceFor, applyMutations } from './simulate.js'
import { ENGINE_VERSION } from './version.js'

const MAX_ACTIONS = 7

// Rank score for actions the chance model can't quantify. Modeled actions rank
// on Δchance/effortWeeks (typically 0.3–2.5); these constants slot the
// strategic actions into that scale deliberately: money reality and the one-shot
// ED decision near the top, slow curriculum work near the bottom.
const STRATEGIC_ROI = {
  AID_SHORTFALL: 3.0,
  ED_LEVERAGE: 2.0,
  NEED_BLIND_OPPORTUNITY: 1.8,
  EC_BREADTH_WITHOUT_DEPTH: 1.2,
  TECHNICAL_DEPTH_GAP: 1.2,
  NARRATIVE_INCOHERENCE: 1.0,
  TEST_OPTIONAL_ARBITRAGE: 0.9,
  GPA_SHORTFALL: 0.6,
  RIGOR_GAP: 0.5,
  DEMONSTRATED_INTEREST: 0.3,
}

// Strategic-only actions: present even when every measured dimension is at
// par. They never block CEILING_REACHED — a plan of pure strategy notes still
// deserves the "your profile is competitive" verdict on top.
const NOT_GAP_DRIVEN = new Set(['DEMONSTRATED_INTEREST', 'NEED_BLIND_OPPORTUNITY', 'ED_LEVERAGE', 'TEST_OPTIONAL_ARBITRAGE'])

// ── application-cycle math ───────────────────────────────────────────────────
// A cycle is named by its fall-entry year E: deadlines run Oct(E-1)–Mar(E).
// Grade shifts which cycle the student is actually applying in.

const GRADE_OFFSET = [
  [/12th|gap/i, 0],
  [/11th/i, 1],
  [/10th/i, 2],
  [/9th/i, 3],
]

export function fallEntryYear(now, grade) {
  const base = now.getUTCMonth() + 1 >= 8 ? now.getUTCFullYear() + 1 : now.getUTCFullYear()
  const offset = GRADE_OFFSET.find(([re]) => re.test(grade || ''))?.[1] ?? 0
  return base + offset
}

// 'MM-DD' in the cycle for fall-entry year E → UTC date. Fall-side deadlines
// (Aug–Dec) belong to E-1, spring-side (Jan–Jul) to E.
function cycleDate(mmdd, entryYear) {
  const [mm, dd] = mmdd.split('-').map(Number)
  return new Date(Date.UTC(mm >= 8 ? entryYear - 1 : entryYear, mm - 1, dd))
}

const iso = d => d.toISOString().slice(0, 10)
const weeksUntil = (from, to) => (to - from) / (7 * 24 * 3600 * 1000)

// Deadline anchors: 'testing' targets the last SAT sitting that reliably
// reaches a January file (early December); 'ed' the ED deadline; 'application'
// the regular deadline. Unpublished dates fall back to the season's norm.
function anchorDate(anchor, resolved, entryYear) {
  const plans = resolved.admissions?.decisionPlans
  if (anchor === 'testing') return cycleDate('12-01', entryYear)
  if (anchor === 'ed') return cycleDate(plans?.ed?.deadline || '11-01', entryYear)
  return cycleDate(plans?.rd?.deadline || '01-01', entryYear)
}

// ── the plan ─────────────────────────────────────────────────────────────────

export function buildPlan(gv, profile, resolved, data, { now = new Date() } = {}) {
  const baseline = chanceFor(profile, resolved)
  const entryYear = fallEntryYear(now, profile.grade)

  // 1. Match rules, 2. simulate the modeled ones, 3. attach deadlines.
  const prescriptions = matchRules(gv, profile, resolved, data).map(p => {
    const modeled = Array.isArray(p.mutations) && p.mutations.length > 0
    const sim = modeled ? simulate(profile, resolved, p.mutations, baseline) : null
    const deadline = anchorDate(p.deadlineAnchor, resolved, entryYear)
    const feasibleThisCycle = p.effortWeeks <= Math.max(0, weeksUntil(now, deadline))
    return {
      ruleId: p.ruleId,
      dimension: p.dimension,
      title: p.title,
      actionSkeleton: p.actionSkeleton,
      rationale: p.rationale,
      modeled,
      mutations: p.mutations || null,
      deltaChance: sim ? sim.delta : null,
      chanceAfter: sim ? sim.chance : null,
      ...(p.alternatives ? { alternatives: p.alternatives } : {}),
      clearsGate: p.clearsGate === true,
      effortWeeks: p.effortWeeks,
      effortLabel: p.effortLabel,
      deadline: { anchor: p.deadlineAnchor, date: iso(deadline) },
      feasibleThisCycle,
    }
  })

  // 4. ROI ranking. Gate-clearing actions outrank everything — nothing else
  // matters at a school whose hard requirement is unmet. Ties break on rule id
  // so the order can never wobble between runs.
  const roi = p => p.clearsGate ? Infinity
    : p.modeled ? (p.deltaChance ?? 0) / Math.max(p.effortWeeks, 1)
    : STRATEGIC_ROI[p.ruleId] ?? 0.5
  prescriptions.sort((a, b) => (roi(b) - roi(a)) || a.ruleId.localeCompare(b.ruleId))

  // 5. One action per dimension — "retake the SAT" must never appear twice.
  const seen = new Set()
  const deduped = prescriptions.filter(p => !seen.has(p.dimension) && seen.add(p.dimension))

  // 6. Feasibility split + cap. Actions that cannot finish before their anchor
  // move to the next-cycle block (a real plan for 9th–11th graders, an honest
  // "this window has closed" for late seniors).
  const actions = deduped.filter(p => p.feasibleThisCycle).slice(0, MAX_ACTIONS)
  const nextCycle = deduped.filter(p => !p.feasibleThisCycle).slice(0, MAX_ACTIONS - Math.min(actions.length, 4))

  // 7. Ceiling verdict: no gap-driven work anywhere → say so, on top.
  const ceiling = !deduped.some(p => !NOT_GAP_DRIVEN.has(p.ruleId))
  if (ceiling) actions.unshift(ceilingPrescription(gv))

  // 8. Composite scenarios (spec §7.3) — mutations compound: apply the whole
  // set to one profile and re-run the pure scoring. Order-independent because
  // each mutation touches an independent field.
  const compound = list => {
    const muts = list.flatMap(p => p.mutations || [])
    if (!muts.length) return { chance: baseline.chance, delta: 0, strength: baseline.strength, actions: list.map(p => p.ruleId) }
    const after = chanceFor(applyMutations(profile, muts), resolved)
    return { chance: after.chance, delta: after.chance - baseline.chance, strength: after.strength, actions: list.map(p => p.ruleId) }
  }
  const realActions = actions.filter(p => p.ruleId !== 'CEILING_REACHED')
  const scenarios = {
    minimum: compound(realActions.slice(0, 1)),
    realistic: compound(realActions),
    maximum: compound([...realActions, ...nextCycle]),
  }

  return {
    engineVersion: ENGINE_VERSION,
    generatedAt: iso(now),
    cycle: { fallEntryYear: entryYear, grade: profile.grade || null },
    baseline: { strength: baseline.strength, chance: baseline.chance },
    actions,
    nextCycle,
    scenarios,
    ceiling,
  }
}
