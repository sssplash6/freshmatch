// @vitest-environment node
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { it, expect } from 'vitest'

// db.js opens DATABASE_PATH at import time, so set it before importing.
process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), 'fm-list-')), 'db.sqlite')
const { saveSubmission, listSubmissions } = await import('../db.js')

it('lists IELTS and a GPA out of 4 for the admin filters', () => {
  saveSubmission({ email: 'a@x.com', testScores: { gpa: '85', gpaScale: '100', ielts: '7.5' } }, { schools: [] })
  saveSubmission({ email: 'b@x.com', testScores: { gpa: 'N/A', ielts: '' } }, { schools: [] })
  const byEmail = Object.fromEntries(listSubmissions(10).map(r => [r.email, r]))
  expect(byEmail['a@x.com']).toMatchObject({ ielts: '7.5', gpa_scale: '100' })
  expect(byEmail['a@x.com'].gpa4).toBeCloseTo(3.4)
  expect(byEmail['b@x.com'].gpa4).toBeNull()
})
