// Improvement engine tests: counterfactual simulation, rule firing, ROI
// ranking, dedup, feasibility, scenarios, and the ceiling verdict.
import { describe, it, expect, beforeAll } from 'vitest'
import { loadData } from '../../data.js'
import { resolveCollege } from '../college.js'
import { buildGapVector } from '../gapVector.js'
import { applyMutations, simulate, chanceFor } from '../simulate.js'
import { buildPlan, fallEntryYear } from '../plan.js'

// Frozen clock for deterministic cycle math: an 11th grader in August 2026
// applies in the cycle ending with fall-2028 entry.
const NOW = new Date(Date.UTC(2026, 7, 13))

const workedExample = () => ({
  testScores: { sat: '1450', gpa: '3.85', gpaScale: '4', ielts: '8.0' },
  honors: [{ title: 'National Informatics Olympiad — Silver', level: 'natl' }],
  extracurriculars: [
    { description: 'Founded the school robotics club and led weekly build sessions for 30 students' },
    { description: 'Volunteer math tutor for younger students at a community center since 2023' },
    { description: 'Member of the national chess federation, competed in regional tournaments' },
    { description: 'School debate team member for 3 years' },
    { description: 'Photography club, organized the annual school exhibition' },
    { description: 'Part-time helper in my family\'s small business on weekends' },
  ],
  majors: ['Computer Science'],
  efc: 20000,
  grade: '11th Grade',
})

let data, stanford

beforeAll(async () => {
  data = await loadData()
  stanford = resolveCollege('stanford', data)
})

describe('simulate', () => {
  it('re-runs the pure scoring on a mutated profile', () => {
    const profile = workedExample()
    const sim = simulate(profile, stanford, [{ type: 'sat', value: 1540 }])
    // SAT 1450→1540 moves the band 10→28 → strength 44→62 → chance 28→41
    expect(sim.baseline.chance).toBe(28)
    expect(sim.strength).toBe(62)
    expect(sim.chance).toBe(41)
    expect(sim.delta).toBe(13)
  })

  it('never mutates the original profile', () => {
    const profile = workedExample()
    const frozen = JSON.stringify(profile)
    applyMutations(profile, [
      { type: 'sat', value: 1600 },
      { type: 'gpaNorm', value: 4 },
      { type: 'addHonor', level: 'intl' },
      { type: 'addEc', description: 'x' },
    ])
    expect(JSON.stringify(profile)).toBe(frozen)
  })

  it('expresses GPA targets in the student\'s own scale', () => {
    const after = applyMutations({ testScores: { gpa: '7', gpaScale: '10' } }, [{ type: 'gpaNorm', value: 3.8 }])
    expect(parseFloat(after.testScores.gpa)).toBeCloseTo(9.5)
    expect(chanceFor({ ...after, efc: 20000 }, stanford).strength).toBeGreaterThan(0)
  })
})

describe('buildPlan — worked example vs Stanford', () => {
  let gv, plan
  beforeAll(() => {
    const profile = workedExample()
    gv = buildGapVector(profile, stanford)
    plan = buildPlan(gv, profile, stanford, data, { now: NOW })
  })

  it('leads with the SAT retake — the highest modeled ROI', () => {
    expect(plan.actions[0].ruleId).toBe('SAT_BELOW_P25')
    expect(plan.actions[0].deltaChance).toBe(13)
    expect(plan.actions[0].chanceAfter).toBe(41)
    expect(plan.actions[0].title).toContain('1540')
  })

  it('prescribes depth consolidation naming the student\'s own activities', () => {
    const depth = plan.actions.find(a => a.ruleId === 'EC_BREADTH_WITHOUT_DEPTH')
    expect(depth).toBeDefined()
    expect(depth.modeled).toBe(false)
    expect(depth.deltaChance).toBeNull()          // never an invented number
    expect(depth.actionSkeleton).toMatch(/“/)     // quotes their own activity text
  })

  it('prescribes the honor-ceiling push with a real simulated delta', () => {
    const honor = plan.actions.find(a => a.ruleId === 'HONOR_CEILING')
    expect(honor).toBeDefined()
    expect(honor.modeled).toBe(true)
    expect(honor.deltaChance).toBeGreaterThan(0)
    expect(honor.title).toContain('international')
  })

  it('does not flag narrative incoherence for a robotics-founder CS applicant', () => {
    expect(plan.actions.find(a => a.ruleId === 'NARRATIVE_INCOHERENCE')).toBeUndefined()
  })

  it('caps at 7, keeps one action per dimension, and is not a ceiling profile', () => {
    expect(plan.actions.length).toBeLessThanOrEqual(7)
    const dims = plan.actions.map(a => a.dimension)
    expect(new Set(dims).size).toBe(dims.length)
    expect(plan.ceiling).toBe(false)
  })

  it('everything is feasible for an 11th grader — deadlines sit a cycle away', () => {
    expect(fallEntryYear(NOW, '11th Grade')).toBe(2028)
    expect(plan.nextCycle).toEqual([])
    for (const a of plan.actions) expect(a.feasibleThisCycle).toBe(true)
  })

  it('compounds scenarios through the pure scoring functions', () => {
    expect(plan.scenarios.minimum.chance).toBe(41)      // SAT alone
    expect(plan.scenarios.realistic.chance).toBeGreaterThan(plan.scenarios.minimum.chance)
    expect(plan.scenarios.maximum.chance).toBeGreaterThanOrEqual(plan.scenarios.realistic.chance)
    expect(plan.scenarios.realistic.delta).toBe(plan.scenarios.realistic.chance - plan.baseline.chance)
  })

  it('is deterministic for a frozen clock', () => {
    const again = buildPlan(gv, workedExample(), stanford, data, { now: NOW })
    expect(JSON.stringify(again)).toBe(JSON.stringify(plan))
  })
})

describe('buildPlan — edge cases', () => {
  it('puts gate-clearing above everything at a hard-gated school', () => {
    const profile = workedExample()
    const colby = resolveCollege('colby', data)
    const gv = buildGapVector(profile, colby)
    const plan = buildPlan(gv, profile, colby, data, { now: NOW })
    expect(plan.actions[0].ruleId).toBe('GATE_BLOCKED')
    expect(plan.actions[0].clearsGate).toBe(true)
    expect(plan.actions[0].title).toContain('1540')
  })

  it('demotes slow actions to next cycle for a senior deep in the fall', () => {
    const profile = { ...workedExample(), grade: '12th Grade' }
    const lateNovember = new Date(Date.UTC(2026, 10, 20)) // RD ~6 weeks out
    const gv = buildGapVector(profile, stanford)
    const plan = buildPlan(gv, profile, stanford, data, { now: lateNovember })
    // 7-week SAT prep cannot land before the Dec 1 testing anchor.
    expect(plan.actions.find(a => a.ruleId === 'SAT_BELOW_P25')).toBeUndefined()
    expect(plan.nextCycle.find(a => a.ruleId === 'SAT_BELOW_P25')).toBeDefined()
  })

  it('declares ceiling for a profile with no meaningful gaps', () => {
    const star = {
      testScores: { sat: '1590', gpa: '4.0', gpaScale: '4', ielts: '8.5', ap: 'Calc BC, Physics C, CS A, Chemistry' },
      honors: [
        { title: 'International Physics Olympiad — Gold', level: 'intl' },
        { title: 'International Mathematical Olympiad — Silver', level: 'intl' },
      ],
      extracurriculars: [
        { description: 'Founded a national physics-tutoring platform serving 2000 students, led a team of 12' },
        { description: 'Published research paper on quantum computing with a university lab' },
        { description: 'Built and shipped an open-source physics simulation app on GitHub' },
        { description: 'Captain of the national physics team for 2 years' },
        { description: 'Organized a city-wide science fair with 300 participants' },
      ],
      majors: ['Physics'],
      efc: 90000,
      grade: '12th Grade',
    }
    const jhu = resolveCollege('johns-hopkins', data)
    const gv = buildGapVector(star, jhu)
    const plan = buildPlan(gv, star, jhu, data, { now: NOW })
    expect(plan.ceiling).toBe(true)
    expect(plan.actions[0].ruleId).toBe('CEILING_REACHED')
  })

  it('fires the aid-shortfall rule with comparable fundable alternatives from our data', () => {
    // Synthetic under-funded selective school so the test doesn't depend on
    // which real schools currently have aid gaps.
    const resolved = {
      school: { id: 'stingy-u', name: 'Stingy University', stats: { accepted: '12%' }, strongPrograms: ['Computer Science'], ratings: {} },
      fin: { id: 'stingy-u', name: 'Stingy University', noAid: false, avgAid: 20000 },
      admissions: null,
    }
    const profile = workedExample() // $15–25k bracket needs $55k/yr
    const gv = buildGapVector(profile, resolved)
    const plan = buildPlan(gv, profile, resolved, data, { now: NOW })
    const aid = plan.actions.find(a => a.ruleId === 'AID_SHORTFALL')
    expect(aid).toBeDefined()
    expect(aid.alternatives.length).toBeGreaterThan(0)
    for (const alt of aid.alternatives) expect(alt.name).toBeTruthy()
  })

  it('recommends ED only when the money genuinely works', () => {
    // Northwestern: ED offered, and the worked example's chance there sits in
    // the 35–60 band once eligible aid is confirmed.
    const nw = resolveCollege('northwestern', data)
    const profile = workedExample()
    const gv = buildGapVector(profile, nw)
    const plan = buildPlan(gv, profile, nw, data, { now: NOW })
    const ed = plan.actions.find(a => a.ruleId === 'ED_LEVERAGE')
    if (gv.chance >= 35 && gv.chance <= 60 && gv.gates.financialFilter.passed) {
      expect(ed).toBeDefined()
      expect(ed.actionSkeleton).toMatch(/binding/i)
    } else {
      expect(ed).toBeUndefined()
    }
  })
})
