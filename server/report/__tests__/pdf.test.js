// @vitest-environment node
// PDF pipeline smoke tests — full generate→render, zero tokens (compose off).
import { describe, it, expect, beforeAll } from 'vitest'
import { generateReport } from '../generate.js'
import { renderReportPdf } from '../pdf.js'

const NOW = new Date(Date.UTC(2026, 7, 13))

const profile = {
  name: 'Aziz Karimov', country: 'Uzbekistan', grade: '11th Grade',
  testScores: { sat: '1450', gpa: '3.85', gpaScale: '4', ielts: '8.0' },
  honors: [{ title: 'National Informatics Olympiad — Silver', level: 'natl' }],
  extracurriculars: [
    { description: 'Founded the school robotics club and led weekly build sessions for 30 students' },
    { description: 'Volunteer math tutor for younger students at a community center since 2023' },
    { description: 'School debate team member for 3 years' },
    { description: 'Photography club, organized the annual school exhibition' },
    { description: 'Member of the national chess federation, competed in regional tournaments' },
  ],
  majors: ['Computer Science'], efc: 20000,
}

describe('generateReport', () => {
  it('returns null for unknown colleges', async () => {
    expect(await generateReport(profile, 'hogwarts', { now: NOW, compose: false })).toBeNull()
  })

  it('assembles the full report object without touching the model', async () => {
    const report = await generateReport(profile, 'stanford', { fitScore: 84, now: NOW, compose: false })
    expect(report.proseSource).toBe('fallback')
    expect(report.gapVector.chance).toBe(28)
    expect(report.plan.actions.length).toBeGreaterThan(0)
    expect(report.prose.actions[report.plan.actions[0].ruleId]).toBeTruthy()
    expect(report.student.name).toBe('Aziz Karimov')
    expect(report.profileEfc).toBe(20000)
  })
})

describe('renderReportPdf', () => {
  it('renders a real multi-page PDF', async () => {
    const report = await generateReport(profile, 'stanford', { fitScore: 84, now: NOW, compose: false })
    const buf = await renderReportPdf(report)
    expect(buf.slice(0, 5).toString()).toBe('%PDF-')
    expect(buf.length).toBeGreaterThan(15000)
  }, 30000)

  it('renders schools with every logo situation (AVIF-mislabeled, palette PNG, branch campus, none)', async () => {
    for (const id of ['stanford', 'mit', 'cmu-q', 'babson']) {
      const report = await generateReport(profile, id, { now: NOW, compose: false })
      const buf = await renderReportPdf(report)
      expect(buf.slice(0, 5).toString(), id).toBe('%PDF-')
    }
  }, 60000)
})
