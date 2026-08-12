// Integrity checks for the admitted-student benchmark dataset. These guard the
// invariants the gap engine relies on: full id parity with the financial file
// (the id universe reports can be requested for), ordered percentile bands,
// plausible bounds, and the null-means-unknown discipline (blind schools must
// not carry score bands).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const admissionsFile = JSON.parse(readFileSync(join(__dir, '../data/schools-admissions.json'), 'utf8'))
const financial = JSON.parse(readFileSync(join(__dir, '../data/schools-financial.json'), 'utf8'))
const entries = admissionsFile.schools

describe('schools-admissions.json', () => {
  it('has exactly one entry per financial-file school id', () => {
    const admissionIds = entries.map(e => e.id)
    const financialIds = financial.map(f => f.id)
    expect(new Set(admissionIds).size).toBe(admissionIds.length) // no duplicates
    expect([...admissionIds].sort()).toEqual([...financialIds].sort())
  })

  it('keeps SAT bands ordered, bounded, and in 10-point steps', () => {
    for (const e of entries.filter(e => e.sat)) {
      const { p25, p50, p75 } = e.sat
      expect(p25, e.id).toBeGreaterThanOrEqual(400)
      expect(p75, e.id).toBeLessThanOrEqual(1600)
      expect(p25, e.id).toBeLessThanOrEqual(p50)
      expect(p50, e.id).toBeLessThanOrEqual(p75)
      for (const v of [p25, p50, p75]) expect(v % 10, `${e.id} ${v}`).toBe(0)
    }
  })

  it('keeps ACT bands ordered and within 1–36', () => {
    for (const e of entries.filter(e => e.act)) {
      const { p25, p50, p75 } = e.act
      expect(p25, e.id).toBeGreaterThanOrEqual(1)
      expect(p75, e.id).toBeLessThanOrEqual(36)
      expect(p25, e.id).toBeLessThanOrEqual(p50)
      expect(p50, e.id).toBeLessThanOrEqual(p75)
    }
  })

  it('uses only known test policies, and blind schools carry no score bands', () => {
    for (const e of entries) {
      expect([null, 'required', 'optional', 'blind'], e.id).toContain(e.testPolicy)
      if (e.testPolicy === 'blind') {
        expect(e.sat, e.id).toBeNull()
        expect(e.act, e.id).toBeNull()
      }
    }
  })

  it('shapes decision plans consistently (offered flag, MM-DD deadlines, fractional ED rates)', () => {
    const MMDD = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
    for (const e of entries) {
      const { ed, ea, rd } = e.decisionPlans
      for (const plan of [ed, ea]) {
        expect([true, false, null], e.id).toContain(plan.offered)
        if (plan.deadline != null) expect(plan.deadline, e.id).toMatch(MMDD)
      }
      if (rd.deadline != null) expect(rd.deadline, e.id).toMatch(MMDD)
      if (ed.admitRate != null) {
        expect(ed.admitRate, e.id).toBeGreaterThan(0)
        expect(ed.admitRate, e.id).toBeLessThan(1)
      }
    }
  })

  it('flags every entry with a confidence level and nullable interest/intl fields', () => {
    for (const e of entries) {
      expect(['high', 'medium'], e.id).toContain(e.confidence)
      expect([true, false, null], e.id).toContain(e.demonstratedInterest)
      if (e.internationalAdmitRate !== null) {
        expect(e.internationalAdmitRate, e.id).toBeGreaterThan(0)
        expect(e.internationalAdmitRate, e.id).toBeLessThan(1)
      }
    }
  })
})
