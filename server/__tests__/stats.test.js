// @vitest-environment node
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, it, expect } from 'vitest'

// db.js opens DATABASE_PATH at import time, so set it before importing.
process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), 'fm-stats-')), 'db.sqlite')
const { saveSubmission, saveReport, getStats } = await import('../db.js')

describe('getStats', () => {
  it('counts students by email, returners, countries and reports, and names no one', () => {
    const run = (email, country) => saveSubmission({ name: 'Secret Name', email, country }, { schools: [] })
    run('A@x.com', 'Uzbekistan')
    run('a@x.com', 'Uzbekistan')   // same student, different case: a returner
    run('b@x.com', 'Kazakhstan')
    run('c@x.com', 'Uzbekistan')
    for (const e of ['d', 'e', 'f']) run(`${e}@x.com`, 'Visit spam.example')   // not a country
    saveReport({ reportKey: 'k1', collegeId: 'nyu', engineVersion: '1' })
    saveReport({ reportKey: 'k2', collegeId: 'nyu', engineVersion: '1' })

    const s = getStats()
    expect(s).toMatchObject({
      assessments: 7, students: 6, countries: 2, returners: 1, lastWeek: 7, reports: 2, colleges: 1,
    })
    // Kazakhstan counts as a country but has too few assessments to be named.
    expect(s.topCountries).toEqual([{ country: 'Uzbekistan', n: 3 }])
    expect(JSON.stringify(s)).not.toMatch(/Secret|@x\.com|spam/)
  })
})
