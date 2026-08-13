// Composer tests. The model is mocked — these verify the contract around it:
// complete deterministic fallback, granular schema validation, and that a
// model failure can never block a report.
import { describe, it, expect, beforeAll, vi, beforeEach } from 'vitest'

vi.mock('../../_openrouter.js', () => ({ chat: vi.fn() }))

import { chat } from '../../_openrouter.js'
import { loadData } from '../../data.js'
import { resolveCollege } from '../college.js'
import { buildGapVector } from '../gapVector.js'
import { buildPlan } from '../plan.js'
import { composeProse, fallbackProse, validateProse } from '../compose.js'

const NOW = new Date(Date.UTC(2026, 7, 13))

const profile = {
  testScores: { sat: '1450', gpa: '3.85', gpaScale: '4', ielts: '8.0' },
  honors: [{ title: 'National Informatics Olympiad — Silver', level: 'natl' }],
  extracurriculars: [
    { description: 'Founded the school robotics club and led weekly build sessions for 30 students' },
    { description: 'Volunteer math tutor for younger students at a community center since 2023' },
    { description: 'School debate team member for 3 years' },
    { description: 'Photography club, organized the annual school exhibition' },
    { description: 'Member of the national chess federation, competed in regional tournaments' },
  ],
  majors: ['Computer Science'],
  efc: 20000,
  grade: '11th Grade',
  name: 'Aziz',
  country: 'Uzbekistan',
}

let data, resolved, gv, plan

beforeAll(async () => {
  data = await loadData()
  resolved = resolveCollege('stanford', data)
  gv = buildGapVector(profile, resolved)
  plan = buildPlan(gv, profile, resolved, data, { now: NOW })
})

beforeEach(() => {
  chat.mockReset()
})

describe('fallbackProse', () => {
  it('covers every section and every plan action with zero tokens', () => {
    const prose = fallbackProse(gv, plan, profile, resolved)
    expect(prose.verdict).toContain(String(gv.chance))
    expect(prose.whyFits.length).toBeGreaterThan(50)
    expect(prose.standingSummary.length).toBeGreaterThan(20)
    expect(prose.workingAgainst.length).toBeGreaterThan(0)
    expect(prose.essayAngles.length).toBeGreaterThan(0)
    for (const a of [...plan.actions, ...plan.nextCycle]) {
      expect(prose.actions[a.ruleId], a.ruleId).toBeTruthy()
    }
  })

  it('is deterministic', () => {
    const a = fallbackProse(gv, plan, profile, resolved)
    const b = fallbackProse(gv, plan, profile, resolved)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})

describe('validateProse', () => {
  it('merges valid model fields over the fallback and keeps fallback for bad ones', () => {
    const fallback = fallbackProse(gv, plan, profile, resolved)
    const merged = validateProse({
      verdict: 'A genuine reach worth planning for.',
      whyFits: '',                                  // empty → fallback survives
      workingAgainst: ['One concern', 42, 'Two'],   // non-strings dropped
      actions: {
        [plan.actions[0].ruleId]: 'Rewritten action prose.',
        NOT_A_REAL_RULE: 'Injected action that must never render.',
      },
    }, plan, fallback)
    expect(merged.verdict).toBe('A genuine reach worth planning for.')
    expect(merged.whyFits).toBe(fallback.whyFits)
    expect(merged.workingAgainst).toEqual(['One concern', 'Two'])
    expect(merged.actions[plan.actions[0].ruleId]).toBe('Rewritten action prose.')
    expect(merged.actions.NOT_A_REAL_RULE).toBeUndefined()
    // Untouched actions keep their skeletons.
    expect(merged.actions[plan.actions[1].ruleId]).toBe(fallback.actions[plan.actions[1].ruleId])
  })

  it('caps runaway field lengths', () => {
    const fallback = fallbackProse(gv, plan, profile, resolved)
    const merged = validateProse({ verdict: 'x'.repeat(9999) }, plan, fallback)
    expect(merged.verdict.length).toBeLessThanOrEqual(180)
  })
})

describe('composeProse', () => {
  it('uses model prose when the call returns valid JSON', async () => {
    chat.mockResolvedValue(JSON.stringify({
      verdict: 'Model verdict.',
      whyFits: 'Model fit paragraph.',
      standingSummary: 'Model standing.',
      workingAgainst: ['Model concern'],
      actions: {},
      strategy: 'Model strategy.',
      essayAngles: ['Model angle'],
      timelineNote: 'Model note.',
    }))
    const { prose, source } = await composeProse(profile, gv, plan, resolved)
    expect(source).toBe('model')
    expect(prose.verdict).toBe('Model verdict.')
    // Fenced, cache-friendly prompt: student profile before college material.
    const msg = chat.mock.calls[0][0][0].content
    expect(msg.indexOf('===STUDENT_PROFILE_START===')).toBeLessThan(msg.indexOf('LOCKED ANALYSIS'))
    expect(msg).toContain(`Modeled chance ${gv.chance}`)
  })

  it('falls back completely when the model call throws', async () => {
    chat.mockRejectedValue(new Error('timeout'))
    const { prose, source } = await composeProse(profile, gv, plan, resolved)
    expect(source).toBe('fallback')
    expect(prose.verdict).toContain(String(gv.chance))
  })

  it('falls back when the model returns garbage', async () => {
    chat.mockResolvedValue('I am sorry, I cannot produce JSON today.')
    const { prose, source } = await composeProse(profile, gv, plan, resolved)
    expect(source).toBe('fallback')
    expect(prose.actions[plan.actions[0].ruleId]).toBeTruthy()
  })

  it('recovers JSON wrapped in markdown fences and prose', async () => {
    chat.mockResolvedValue('Here you go:\n```json\n{"verdict":"Fenced verdict."}\n```\nHope that helps!')
    const { prose, source } = await composeProse(profile, gv, plan, resolved)
    expect(source).toBe('model')
    expect(prose.verdict).toBe('Fenced verdict.')
  })
})
