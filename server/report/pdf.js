// PDF rendering — @react-pdf/renderer, server-side, no headless browser.
//
// Written with React.createElement (the server runs plain Node, no JSX
// transform). Structure and every number come from the deterministic report
// object; prose fields come from the composer (model or fallback — the layout
// cannot tell the difference). The theme object is the white-label seam: a
// partner build passes different colors/footer, not a fork.
import React from 'react'
import { Document, Page, Text, View, Image, StyleSheet, Font, renderToBuffer } from '@react-pdf/renderer'
import { existsSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { schoolBadge } from '../../src/data/schoolLogos.js'
import { efcLabel, EFC_BRACKETS } from '../scoring.js'

// The built-in PDF fonts (Times/Helvetica) are WinAnsi-encoded: glyphs outside
// that set (≥, ≈, arrows, geometric markers — easy for model-composed prose to
// emit) render as garbage. Map the known offenders to safe equivalents on
// every string child.
const WINANSI_MAP = { '≥': '>=', '≤': '<=', '≈': '~', '→': '->', '←': '<-', '⇒': '->', '▲': '+', '▼': '-', '●': '•', '✓': '+', '✗': 'x', '★': '*', '–': '–', '—': '—' }
const winAnsi = str => str.replace(/[≥≤≈→←⇒▲▼●✓✗★]/g, c => WINANSI_MAP[c] || '?')
const h = (type, props, ...children) =>
  React.createElement(type, props, ...children.map(c => (typeof c === 'string' ? winAnsi(c) : c)))

// Never split words ("Technolo-gy" on a cover is not a look) — wrap on word
// boundaries only.
Font.registerHyphenationCallback(word => [word])
const __dir = dirname(fileURLToPath(import.meta.url))
const PUBLIC = join(__dir, '../../public')

// FreshMatch brand (navy / orange / serif), print-adapted.
export const DEFAULT_THEME = {
  navy: '#0d2040',
  ink: '#0b1d38',
  paper: '#ffffff',
  cream: '#f5efe4',
  orange: '#d97a00',
  orangeBright: '#f18d05',
  faint: 'rgba(11, 29, 56, 0.55)',
  rule: 'rgba(11, 29, 56, 0.16)',
  footerText: 'FreshMatch — a Freshman Academy product',
}

const STATUS_COLORS = theme => ({
  surplus: '#1c7c54',
  'at-par': theme.navy,
  shortfall: theme.orange,
  critical: '#b3261e',
})
const STATUS_LABELS = { surplus: 'ahead', 'at-par': 'at par', shortfall: 'behind', critical: 'critical' }

const fmtMoney = n => `$${Math.round(n).toLocaleString('en-US')}`
const fmtDate = isoDate => {
  const [y, m, d] = isoDate.split('-').map(Number)
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${MONTHS[m - 1]} ${d}, ${y}`
}

function makeStyles(t) {
  return StyleSheet.create({
    // cover
    cover: { backgroundColor: t.navy, color: t.cream, padding: 48, fontFamily: 'Times-Roman' },
    coverBrand: { fontFamily: 'Helvetica-Bold', fontSize: 11, letterSpacing: 2, color: t.orangeBright, textTransform: 'uppercase' },
    coverEyebrow: { fontFamily: 'Helvetica', fontSize: 9, letterSpacing: 2, color: t.cream, opacity: 0.7, textTransform: 'uppercase', marginTop: 4 },
    coverSchool: { fontSize: 34, marginTop: 10, lineHeight: 1.15 },
    coverStudent: { fontFamily: 'Helvetica', fontSize: 11, marginTop: 10, opacity: 0.85 },
    logoBox: { width: 76, height: 76, backgroundColor: '#ffffff', borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 26 },
    logoImg: { width: 60, height: 60, objectFit: 'contain' },
    logoMono: { fontFamily: 'Helvetica-Bold', fontSize: 22, color: t.navy },
    statRow: { flexDirection: 'row', marginTop: 30, gap: 28 },
    statNum: { fontFamily: 'Helvetica-Bold', fontSize: 40, color: t.orangeBright },
    statLabel: { fontFamily: 'Helvetica', fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', opacity: 0.75, marginTop: 4 },
    verdict: { fontSize: 15, lineHeight: 1.5, marginTop: 30, paddingTop: 18, borderTop: `1.2 solid ${t.orangeBright}` },
    coverMeta: { position: 'absolute', bottom: 40, left: 48, right: 48, fontFamily: 'Helvetica', fontSize: 8, opacity: 0.65, lineHeight: 1.6 },

    // body
    page: { backgroundColor: t.paper, color: t.ink, paddingTop: 52, paddingBottom: 64, paddingHorizontal: 52, fontFamily: 'Times-Roman', fontSize: 10.5, lineHeight: 1.55 },
    sectionHead: { marginBottom: 10, marginTop: 6 },
    eyebrow: { fontFamily: 'Helvetica-Bold', fontSize: 8.5, letterSpacing: 2, textTransform: 'uppercase', color: t.orange },
    sectionTitle: { fontSize: 19, color: t.navy, marginTop: 3 },
    rule: { borderBottom: `1 solid ${t.rule}`, marginTop: 8 },
    para: { marginBottom: 8 },
    small: { fontFamily: 'Helvetica', fontSize: 8.5, color: t.faint },

    // standing table
    row: { flexDirection: 'row', borderBottom: `0.6 solid ${t.rule}`, paddingVertical: 6, alignItems: 'center' },
    thRow: { flexDirection: 'row', borderBottom: `1.2 solid ${t.navy}`, paddingBottom: 4, marginTop: 12 },
    th: { fontFamily: 'Helvetica-Bold', fontSize: 8, letterSpacing: 1, textTransform: 'uppercase', color: t.navy },
    cDim: { width: '24%', paddingRight: 6 },
    cYou: { width: '18%', paddingRight: 6 },
    cBench: { width: '30%', paddingRight: 6 },
    cStatus: { width: '14%' },
    cWeight: { width: '14%' },
    dimName: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: t.navy },
    cellText: { fontSize: 9.5 },
    statusChip: { fontFamily: 'Helvetica-Bold', fontSize: 8 },
    weightBarWrap: { height: 5, backgroundColor: t.rule, borderRadius: 2.5, marginTop: 3 },
    weightBar: { height: 5, borderRadius: 2.5 },

    // evidence list
    evidenceRow: { flexDirection: 'row', marginBottom: 7 },
    evidenceMarker: { fontFamily: 'Helvetica-Bold', width: 16, fontSize: 10 },

    // actions
    action: { marginBottom: 14, paddingLeft: 14, borderLeft: `2 solid ${t.orange}` },
    actionTitle: { fontFamily: 'Helvetica-Bold', fontSize: 12, color: t.navy, marginBottom: 3 },
    actionMeta: { flexDirection: 'row', gap: 14, marginBottom: 5 },
    metaItem: { fontFamily: 'Helvetica', fontSize: 8.5, color: t.faint },
    deltaChip: { fontFamily: 'Helvetica-Bold', fontSize: 8.5, color: t.orange },

    // scenarios
    scenarioRow: { marginBottom: 12 },
    scenarioLabel: { fontFamily: 'Helvetica-Bold', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: t.navy, marginBottom: 3 },
    scenarioBarWrap: { height: 12, backgroundColor: t.rule, borderRadius: 6 },
    scenarioBar: { height: 12, borderRadius: 6, backgroundColor: t.orange },

    // money
    moneyRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottom: `0.6 solid ${t.rule}`, paddingVertical: 5 },
    moneyLabel: { fontFamily: 'Helvetica', fontSize: 9.5 },
    moneyValue: { fontFamily: 'Helvetica-Bold', fontSize: 9.5, color: t.navy },

    // timeline
    tlRow: { flexDirection: 'row', marginBottom: 6 },
    tlDate: { width: 92, fontFamily: 'Helvetica-Bold', fontSize: 9, color: t.orange },
    tlText: { flex: 1, fontSize: 10 },

    footer: { position: 'absolute', bottom: 28, left: 52, right: 52, flexDirection: 'row', justifyContent: 'space-between', fontFamily: 'Helvetica', fontSize: 7.5, color: t.faint },
  })
}

// ── building blocks ──────────────────────────────────────────────────────────

const paras = text => String(text || '').split(/\n\n+/).filter(Boolean)

function SectionHead(s, eyebrow, title) {
  // wrap:false + minPresenceAhead keep the eyebrow from orphaning at a page
  // bottom with its section starting overleaf.
  return h(View, { style: s.sectionHead, wrap: false, minPresenceAhead: 90 },
    h(Text, { style: s.eyebrow }, eyebrow),
    h(Text, { style: s.sectionTitle }, title),
    h(View, { style: s.rule }))
}

function Footer(s, theme, report) {
  return h(View, { style: s.footer, fixed: true },
    h(Text, null, `${theme.footerText} · ${report.college.name}`),
    h(Text, { render: ({ pageNumber, totalPages }) => `Engine ${report.engineVersion} · ${pageNumber} / ${totalPages}` }))
}

function LogoBadge(s, report) {
  const { path, monogram } = schoolBadge(report.college.id, report.college.name)
  // react-pdf's Image treats string sources as URLs, so local marks go in as
  // buffers — and the logo files lie about their format (several .png files
  // are JPEG/AVIF/SVG inside; browsers sniff, react-pdf doesn't). Trust magic
  // bytes only; anything not PNG/JPEG falls back to the monogram, same as the
  // web UI does on image error.
  const abs = path ? join(PUBLIC, path.replace(/^\//, '')) : null
  if (abs && existsSync(abs)) {
    try {
      const data = readFileSync(abs)
      const format = data.length > 4 && data.readUInt32BE(0) === 0x89504e47 ? 'png'
        : data.length > 2 && data[0] === 0xff && data[1] === 0xd8 ? 'jpg'
        : null
      if (format) return h(View, { style: s.logoBox }, h(Image, { style: s.logoImg, src: { data, format } }))
    } catch { /* unreadable file → monogram */ }
  }
  return h(View, { style: s.logoBox }, h(Text, { style: s.logoMono }, monogram))
}

const benchmarkText = v => {
  if (v == null) return '—'
  if (typeof v === 'object') {
    if (v.p25 != null) return `${v.p25} – ${v.p75} (mid 50%)`
    if (v.mean != null) return `~${Number(v.mean).toFixed(2)}${v.source === 'tier-expectation' ? ' (tier est.)' : ''}`
    if (v.expectedUnits != null) return `~${v.expectedUnits} advanced units`
    if (v.expectedCeiling != null) return `${v.expectedCeiling} level`
    if (v.expectedDeep != null) return `~${v.expectedDeep} deep`
    if (v.expectedCount != null) return `~${v.expectedCount} activities`
    if (v.policy) return v.policy
    if (v.avgAid !== undefined) return v.avgAid != null ? `${fmtMoney(v.avgAid)}/yr typical aid` : 'aid data unavailable'
    if (Array.isArray(v)) return v.join(', ')
    if (v.bands) return 'calibrated bands'
  }
  return String(v)
}

const studentText = v => {
  if (v == null) return 'not on file'
  if (Array.isArray(v)) return v.join(', ')
  if (typeof v === 'object') {
    if (v.deep != null) return `${v.deep} deep (${v.withLeadership} lead / ${v.withArtifact} artifact)`
    return JSON.stringify(v)
  }
  return String(v)
}

// ── the document ─────────────────────────────────────────────────────────────

export function ReportDocument(report, theme = DEFAULT_THEME) {
  const t = { ...DEFAULT_THEME, ...theme }
  const s = makeStyles(t)
  const statusColor = STATUS_COLORS(t)
  const { gapVector: gv, plan, prose } = report

  // — cover —
  const cover = h(Page, { size: 'A4', style: s.cover },
    h(Text, { style: s.coverBrand }, 'FreshMatch'),
    h(Text, { style: s.coverEyebrow }, 'Per-College Report'),
    LogoBadge(s, report),
    h(Text, { style: s.coverSchool }, report.college.name),
    h(Text, { style: s.coverStudent },
      `Prepared for ${report.student.name}${report.student.grade ? ` · ${report.student.grade}` : ''}${report.student.country ? ` · applying from ${report.student.country}` : ''}`),
    h(View, { style: s.statRow },
      h(View, null,
        h(Text, { style: s.statNum }, String(gv.chance)),
        h(Text, { style: s.statLabel }, 'Modeled chance / 100')),
      gv.fitScore != null ? h(View, null,
        h(Text, { style: s.statNum }, String(gv.fitScore)),
        h(Text, { style: s.statLabel }, 'Fit score / 100')) : null,
      h(View, null,
        h(Text, { style: s.statNum }, String(gv.strength)),
        h(Text, { style: s.statLabel }, 'Profile strength / 100'))),
    h(Text, { style: s.verdict }, prose.verdict),
    h(View, { style: s.coverMeta },
      h(Text, null, gv.benchmark
        ? `Benchmarks: ${gv.benchmark.sources.join(', ')} · as of ${gv.benchmark.asOf} · confidence ${gv.benchmark.confidence}`
        : 'No published admitted-score benchmarks for this school — tier-based assessment.'),
      h(Text, null, `Engine ${report.engineVersion} · generated ${fmtDate(report.generatedAt)} · same input always produces this exact analysis`)))

  // — standing —
  const standing = h(View, null,
    SectionHead(s, 'Section 1', 'Where you stand'),
    h(Text, { style: s.para }, prose.standingSummary),
    h(View, { style: s.thRow },
      h(Text, { style: [s.th, s.cDim] }, 'Dimension'),
      h(Text, { style: [s.th, s.cYou] }, 'You'),
      h(Text, { style: [s.th, s.cBench] }, 'Admitted profile'),
      h(Text, { style: [s.th, s.cStatus] }, 'Status'),
      h(Text, { style: [s.th, s.cWeight] }, 'Weight')),
    ...gv.dimensions.map(d => h(View, { key: d.key, style: s.row, wrap: false },
      h(View, { style: s.cDim },
        h(Text, { style: s.dimName }, d.label),
        d.percentile != null ? h(Text, { style: s.small }, `P${d.percentile} of admitted`) : null),
      h(Text, { style: [s.cellText, s.cYou] }, studentText(d.studentValue)),
      h(Text, { style: [s.cellText, s.cBench] }, benchmarkText(d.benchmark)),
      h(Text, { style: [s.statusChip, s.cStatus, { color: statusColor[d.status] }] }, STATUS_LABELS[d.status] || d.status),
      h(View, { style: s.cWeight },
        h(Text, { style: s.cellText }, `${Math.round(d.weight * 100)}%`),
        h(View, { style: s.weightBarWrap },
          h(View, { style: [s.weightBar, { width: `${Math.min(d.weight * 300, 100)}%`, backgroundColor: statusColor[d.status] }] }))))))

  // — why this school —
  const why = h(View, { break: true },
    SectionHead(s, 'Section 2', 'Why this school, for you'),
    ...paras(prose.whyFits).map((p, i) => h(Text, { key: i, style: s.para }, p)))

  // — deciding factors —
  const factors = h(View, null,
    SectionHead(s, 'Section 3', 'What moved the score'),
    ...gv.dimensions.slice(0, 7).map(d => h(View, { key: d.key, style: s.evidenceRow, wrap: false },
      h(Text, { style: [s.evidenceMarker, { color: statusColor[d.status] }] },
        d.status === 'surplus' ? '+' : d.status === 'at-par' ? '•' : '–'),
      h(View, { style: { flex: 1 } },
        h(Text, { style: s.dimName }, `${d.label} — ${Math.round(d.weight * 100)}% of the assessment`),
        h(Text, { style: s.cellText }, d.evidence)))))

  // — working against you —
  const against = h(View, null,
    SectionHead(s, 'Section 4', 'Working against you'),
    ...(prose.workingAgainst.length
      ? prose.workingAgainst.map((c, i) => h(View, { key: i, style: s.evidenceRow, wrap: false },
          h(Text, { style: [s.evidenceMarker, { color: t.orange }] }, '—'),
          h(Text, { style: [s.cellText, { flex: 1 }] }, c)))
      : [h(Text, { style: s.para }, 'Nothing measurable works against this application today.')]))

  // — the plan —
  const actionBlock = (a, i, cycleNote) => h(View, { key: a.ruleId, style: s.action, minPresenceAhead: 80 },
    h(Text, { style: s.actionTitle }, `${i + 1}. ${a.title}`),
    h(View, { style: s.actionMeta },
      a.modeled && a.deltaChance != null
        ? h(Text, { style: s.deltaChip }, `Modeled chance ${plan.baseline.chance} to ${a.chanceAfter} (${a.deltaChance >= 0 ? '+' : ''}${a.deltaChance})`)
        : h(Text, { style: s.metaItem }, a.ruleId === 'CEILING_REACHED' ? 'Verdict' : 'Strategic — value beyond the chance model'),
      h(Text, { style: s.metaItem }, a.effortLabel),
      a.ruleId !== 'CEILING_REACHED' ? h(Text, { style: s.metaItem }, `${cycleNote || 'Complete by'} ${fmtDate(a.deadline.date)}`) : null),
    h(Text, null, prose.actions[a.ruleId] || a.actionSkeleton))

  const path = h(View, null,
    SectionHead(s, 'Section 5', 'Your path in'),
    h(Text, { style: [s.small, { marginBottom: 10 }] },
      'Modeled movements are re-computations of the same deterministic scoring used for the analysis — not estimates. Strategic actions are ones the model does not score; their value is stated, never invented.'),
    ...plan.actions.map((a, i) => actionBlock(a, i)),
    ...(plan.nextCycle.length ? [
      h(Text, { style: [s.eyebrow, { marginTop: 8, marginBottom: 6 }] }, 'Next cycle — cannot land before this application'),
      ...plan.nextCycle.map((a, i) => actionBlock(a, plan.actions.length + i, 'Anchor date')),
    ] : []))

  // — scenarios —
  const scenarioRow = (label, sc, note) => h(View, { style: s.scenarioRow, key: label, wrap: false },
    h(Text, { style: s.scenarioLabel }, `${label} — chance ${sc.chance}${sc.delta ? ` (${sc.delta >= 0 ? '+' : ''}${sc.delta})` : ''}`),
    h(View, { style: s.scenarioBarWrap },
      h(View, { style: [s.scenarioBar, { width: `${Math.min(sc.chance, 100)}%` }] })),
    h(Text, { style: [s.small, { marginTop: 3 }] }, note))

  const scenarios = h(View, null,
    SectionHead(s, 'Section 6', 'Three futures'),
    scenarioRow('Today', { chance: plan.baseline.chance, delta: 0 }, 'The profile as it stands.'),
    scenarioRow('Minimum viable', plan.scenarios.minimum, 'The single highest-yield action, executed.'),
    scenarioRow('Realistic', plan.scenarios.realistic, 'Every action feasible before this cycle\'s deadlines.'),
    scenarioRow('Maximum', plan.scenarios.maximum, 'The full plan, including next-cycle work.'),
    h(Text, { style: s.small }, 'Scenario numbers compound the plan\'s mutations through the same pure scoring functions — reproducible to the digit.'))

  // — strategy —
  const strategy = h(View, null,
    SectionHead(s, 'Section 8', 'Application strategy'),
    ...paras(prose.strategy).map((p, i) => h(Text, { key: `p${i}`, style: s.para }, p)),
    h(Text, { style: [s.eyebrow, { marginTop: 10, marginBottom: 6 }] }, 'Essay angles from your own file'),
    ...prose.essayAngles.map((a, i) => h(View, { key: `a${i}`, style: s.evidenceRow, wrap: false },
      h(Text, { style: [s.evidenceMarker, { color: t.orange }] }, `${i + 1}.`),
      h(Text, { style: [s.cellText, { flex: 1 }] }, a))))

  // — timeline —
  const timelineRows = buildTimeline(report)
  const timeline = h(View, null,
    SectionHead(s, 'Section 9', 'Timeline'),
    h(Text, { style: [s.para, s.small] }, prose.timelineNote),
    ...timelineRows.map((r, i) => h(View, { key: i, style: s.tlRow, wrap: false },
      h(Text, { style: s.tlDate }, fmtDate(r.date)),
      h(Text, { style: s.tlText }, r.label))))

  // — method & limits —
  const method = h(View, { break: true },
    SectionHead(s, 'Section 10', 'Method & limits'),
    ...[
      'Every number in this report — profile strength, modeled chance, deltas, scenario values — comes from deterministic scoring functions, not from an AI model. The same student and the same college always produce this exact analysis under engine ' + report.engineVersion + '.',
      'The modeled chance is a model output, not a calibrated probability: it has not yet been validated against tracked admission outcomes. Treat it as a consistent ruler for comparing schools and actions, not as a prediction with error bars.',
      gv.benchmark
        ? `Admitted-student benchmarks come from published Common Data Set / IPEDS-era figures (${gv.benchmark.sources.join(', ')}; as of ${gv.benchmark.asOf}; confidence: ${gv.benchmark.confidence}). Where a school publishes nothing, this report says so instead of inventing a number. Verify critical figures against the school's current published data.`
        : 'This school publishes no admitted-student score distributions; standing is assessed against its selectivity tier and clearly labeled as such.',
      'Aid figures are averages, not guarantees. Most US schools are need-aware for international applicants, so an aid shortfall lowers admission odds — the modeled chance already discounts for it' + (gv.financialPenalty < 1 ? ` (applied multiplier here: ×${gv.financialPenalty})` : ' (no discount applied here)') + '.',
      'Actions marked "strategic" are not scored by the chance model by design. Where the model cannot quantify an action, this report says so rather than attaching an invented number.',
      report.proseSource === 'model'
        ? 'The narrative text was composed by an AI writer around this locked structure; it cannot change actions or numbers. The structure, scores, and plan are model-free.'
        : 'The narrative text in this copy was produced by the deterministic template layer (no AI call was used); structure, scores, and plan are identical either way.',
    ].map((p, i) => h(Text, { key: i, style: s.para }, p)))

  const body = h(Page, { size: 'A4', style: s.page },
    Footer(s, t, report),
    standing, why, factors, against, path, scenarios, moneySection(report, s, t), strategy, timeline, method)

  return h(Document, {
    title: `${report.college.name} — Per-College Report for ${report.student.name}`,
    author: 'FreshMatch · Freshman Academy',
    subject: `FreshMatch Per-College Report · engine ${report.engineVersion}`,
  }, cover, body)
}

// The money section needs profile-level EFC context that lives on the report.
function moneySection(report, s, t) {
  const gv = report.gapVector
  const efc = report.profileEfc
  const fin = report.fin
  const finDim = gv.dimensions.find(d => d.key === 'financialFeasibility')
  const aidAction = [...report.plan.actions, ...report.plan.nextCycle].find(a => a.ruleId === 'AID_SHORTFALL')
  const bracket = EFC_BRACKETS.find(b => efc <= b.max)
  const rows = [
    ['Family contribution bracket', efcLabel(efc)],
    ['Aid this bracket needs to enroll', bracket.minAid > 0 ? `~${fmtMoney(bracket.minAid)}/yr` : 'None — full cost is workable'],
    ['Typical aid at this school', gv.gates.needBlind.applies ? 'Full demonstrated need (need-blind)' : fin?.avgAid != null ? `${fmtMoney(fin.avgAid)}/yr average` : fin?.noAid ? 'No need-based aid' : 'Not on file'],
    gv.gates.financialFilter.coverage != null ? ['Coverage of your need', `${Math.round(gv.gates.financialFilter.coverage * 100)}%`] : null,
    ['Effect on modeled chance', gv.financialPenalty < 1 ? `×${gv.financialPenalty} multiplier applied (need-aware shortfall)` : 'None — the money works'],
  ].filter(Boolean)

  return h(View, null,
    SectionHead(s, 'Section 7', 'The money'),
    ...rows.map(([label, value], i) => h(View, { key: `r${i}`, style: s.moneyRow, wrap: false },
      h(Text, { style: s.moneyLabel }, label),
      h(Text, { style: s.moneyValue }, value))),
    h(Text, { style: [s.para, { marginTop: 10 }] }, finDim?.evidence || ''),
    ...(aidAction?.alternatives?.length ? [
      h(Text, { style: [s.eyebrow, { marginTop: 8, marginBottom: 5 }] }, 'Comparable schools where the money works'),
      ...aidAction.alternatives.map((alt, i) => h(View, { key: `alt${i}`, style: s.evidenceRow, wrap: false },
        h(Text, { style: [s.evidenceMarker, { color: t.orange }] }, '•'),
        h(Text, { style: [s.cellText, { flex: 1 }] }, `${alt.name} — ${alt.admitRate}% admit${alt.majorFit ? ', strong in your intended major' : ''}`))),
    ] : []))
}

function buildTimeline(report) {
  const rows = []
  const entryYear = report.plan.cycle.fallEntryYear
  const plans = report.admissions?.decisionPlans
  const cycleDate = mmdd => {
    const [mm, dd] = mmdd.split('-').map(Number)
    return `${mm >= 8 ? entryYear - 1 : entryYear}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
  }
  if (plans?.ea?.offered && plans.ea.deadline) rows.push({ date: cycleDate(plans.ea.deadline), label: `${plans.ea.restrictive ? 'Restrictive early action' : 'Early action'} deadline at ${report.college.name}` })
  if (plans?.ed?.offered && plans.ed.deadline) rows.push({ date: cycleDate(plans.ed.deadline), label: `Early decision deadline at ${report.college.name} (binding)` })
  rows.push({ date: cycleDate('12-01'), label: 'Last SAT sitting that reliably reaches a January application' })
  if (plans?.rd?.deadline) rows.push({ date: cycleDate(plans.rd.deadline), label: `Regular decision deadline at ${report.college.name}` })
  else rows.push({ date: cycleDate('01-01'), label: 'Regular decision season opens — confirm this school\'s exact date' })
  for (const a of report.plan.actions) {
    if (a.ruleId === 'CEILING_REACHED') continue
    rows.push({ date: a.deadline.date, label: `Complete: ${a.title}` })
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date))
}

// report → PDF buffer.
export async function renderReportPdf(report, theme) {
  return renderToBuffer(ReportDocument(report, theme))
}
