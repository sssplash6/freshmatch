// Gap Vector engine tests. The primary fixture is the spec's worked example
// (§4.3): SAT 1450 · GPA 3.85/4 · one national honor · six substantive
// activities · CS major · $15–25k EFC, evaluated against Stanford.
import { describe, it, expect, beforeAll } from 'vitest'
import { loadData } from '../../data.js'
import { resolveCollege } from '../college.js'
import { buildGapVector, satPercentile, rigorUnits, ecProfile } from '../gapVector.js'

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

let data

beforeAll(async () => {
  data = await loadData()
})

describe('resolveCollege', () => {
  it('returns null for unknown ids', () => {
    expect(resolveCollege('hogwarts', data)).toBeNull()
  })

  it('resolves branch campuses through the parent Fiske profile but keeps their own identity', () => {
    const { school, fin } = resolveCollege('cmu-q', data)
    expect(school.id).toBe('cmu-q')
    expect(school.name).toBe(fin.name)              // financial file's name wins
    expect(school.strongPrograms?.length).toBeGreaterThan(0) // inherited from carnegie-mellon
  })
})

describe('satPercentile', () => {
  const bands = { p25: 1500, p50: 1540, p75: 1570 }
  it('places the anchor points on 25/50/75', () => {
    expect(satPercentile(1500, bands)).toBe(25)
    expect(satPercentile(1540, bands)).toBe(50)
    expect(satPercentile(1570, bands)).toBe(75)
  })
  it('interpolates between and extrapolates beyond the anchors, clamped to [1,99]', () => {
    expect(satPercentile(1450, bands)).toBeGreaterThan(1)
    expect(satPercentile(1450, bands)).toBeLessThan(25)
    expect(satPercentile(1600, bands)).toBeGreaterThan(75)
    expect(satPercentile(1600, bands)).toBeLessThanOrEqual(99)
    expect(satPercentile(800, bands)).toBe(1)
  })
})

describe('profile readers', () => {
  it('counts rigor units across free-text exam fields', () => {
    expect(rigorUnits({ alevels: 'Math A*, Physics A, CS B', ap: null, ib: null })).toBe(3)
    expect(rigorUnits({ alevels: null, ap: 'Calc BC; Physics C', ib: '40' })).toBe(6) // 2 AP + IB 40 → 4
    expect(rigorUnits({})).toBe(0)
  })

  it('detects depth markers in activities', () => {
    const { deep, withLeadership } = ecProfile(workedExample().extracurriculars)
    expect(withLeadership).toBeGreaterThanOrEqual(1)  // "Founded … led …"
    expect(deep).toBeGreaterThanOrEqual(1)
  })
})

describe('buildGapVector — worked example vs Stanford', () => {
  let gv
  beforeAll(() => {
    gv = buildGapVector(workedExample(), resolveCollege('stanford', data))
  })

  it('mirrors the match pipeline\'s deterministic scores', () => {
    expect(gv.strength).toBe(44)   // SAT 10 + GPA 15 + natl 10 + 6 ECs 9
    expect(gv.chance).toBe(28)     // dreamChanceScore(44, 4%) × penalty 1
    expect(gv.financialPenalty).toBe(1) // Stanford aid covers the $15–25k bracket
  })

  it('computes the testing dimension against published bands', () => {
    const testing = gv.dimensions.find(d => d.key === 'testing')
    expect(testing.status).toBe('shortfall')
    expect(testing.delta).toBe(-50)                 // 1450 vs P25 1500
    expect(testing.percentile).toBeGreaterThan(1)
    expect(testing.percentile).toBeLessThan(25)
    expect(testing.evidence).toContain('1450')
    expect(testing.evidence).toContain('1500')
  })

  it('marks a national honor ceiling as at-par at a ≤5% school', () => {
    const honors = gv.dimensions.find(d => d.key === 'honors')
    expect(honors.status).toBe('at-par')
    expect(honors.studentValue).toBe('National')
  })

  it('marks the CS major as aligned with a flagship program', () => {
    const prog = gv.dimensions.find(d => d.key === 'programAlignment')
    expect(prog.status).toBe('surplus')
  })

  it('normalizes weights to exactly 1 and sorts dimensions by weight', () => {
    const sum = gv.dimensions.reduce((s, d) => s + d.weight, 0)
    expect(sum).toBeCloseTo(1, 10)
    const weights = gv.dimensions.map(d => d.weight)
    expect([...weights].sort((a, b) => b - a)).toEqual(weights)
  })

  it('is deterministic — identical input, identical vector', () => {
    const again = buildGapVector(workedExample(), resolveCollege('stanford', data))
    expect(JSON.stringify(again)).toBe(JSON.stringify(gv))
  })

  it('stamps the engine version and benchmark provenance', () => {
    expect(gv.engineVersion).toMatch(/^pcr-/)
    expect(gv.benchmark.confidence).toBe('high')
    expect(gv.benchmark.sources.length).toBeGreaterThan(0)
  })
})

describe('buildGapVector — degradation & gates', () => {
  it('omits the testing dimension entirely at test-blind schools', () => {
    const gv = buildGapVector(workedExample(), resolveCollege('ucla', data))
    expect(gv.dimensions.find(d => d.key === 'testing')).toBeUndefined()
    const sum = gv.dimensions.reduce((s, d) => s + d.weight, 0)
    expect(sum).toBeCloseTo(1, 10)
  })

  it('surfaces Colby\'s hard SAT minimum as a failed gate', () => {
    const gv = buildGapVector(workedExample(), resolveCollege('colby', data))
    expect(gv.gates.satMinimum).toEqual({ applies: true, required: 1540, met: false })
    const gate = gv.dimensions.find(d => d.key === 'institutionalGates')
    expect(gate.status).toBe('critical')
    expect(gate.evidence).toContain('1540')
  })

  it('marks no-aid schools as financially critical for low-EFC families and floors the chance multiplier', () => {
    const resolved = {
      school: { id: 'fullpay-u', name: 'Full Pay University', stats: { accepted: '30%' }, strongPrograms: [] },
      fin: { id: 'fullpay-u', name: 'Full Pay University', noAid: true, avgAid: null },
      admissions: null,
    }
    const gv = buildGapVector(workedExample(), resolved)
    const finDim = gv.dimensions.find(d => d.key === 'financialFeasibility')
    expect(finDim.status).toBe('critical')
    expect(gv.financialPenalty).toBe(0.4)
  })

  it('treats need-blind campuses as a financial surplus', () => {
    const gv = buildGapVector(workedExample(), resolveCollege('nyuad', data))
    const finDim = gv.dimensions.find(d => d.key === 'financialFeasibility')
    expect(finDim.status).toBe('surplus')
    expect(gv.gates.needBlind.applies).toBe(true)
  })

  it('assesses testing against the selectivity tier when a school has no published bands', () => {
    const resolved = {
      school: { id: 'no-bands-u', name: 'No Bands University', stats: { accepted: '8%' }, strongPrograms: [] },
      fin: { id: 'no-bands-u', name: 'No Bands University', noAid: false, avgAid: 60000 },
      admissions: null,
    }
    const gv = buildGapVector(workedExample(), resolved)
    const testing = gv.dimensions.find(d => d.key === 'testing')
    expect(testing.benchmark).toBeNull()
    expect(testing.percentile).toBeNull()
    expect(testing.evidence).toContain('no published admitted-score bands')
  })

  it('includes characterFit only when a fit score is provided', () => {
    const base = buildGapVector(workedExample(), resolveCollege('stanford', data))
    expect(base.dimensions.find(d => d.key === 'characterFit')).toBeUndefined()
    const withFit = buildGapVector(workedExample(), resolveCollege('stanford', data), { fitScore: 84 })
    const dim = withFit.dimensions.find(d => d.key === 'characterFit')
    expect(dim.status).toBe('at-par')
    expect(withFit.fitScore).toBe(84)
  })
})
