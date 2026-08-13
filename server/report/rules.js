// The prescription rule catalogue (spec §7.2).
//
// Each rule is a pure predicate over the Gap Vector emitting a structured
// prescription. The LLM composer later writes prose AROUND these skeletons —
// it never invents an action, never assigns a Δchance, never reorders. Every
// skeleton must therefore stand on its own: it is what renders if the model
// is unavailable.
//
// `mutations` present → the action is scored by the counterfactual simulator.
// `mutations: null` → strategic action the chance model doesn't quantify; the
// plan says that plainly rather than inventing a number.
import { isFinanciallyEligible, majorMatches, admitRate, isRealEc, isRealHonor } from '../scoring.js'
import { ecProfile } from './gapVector.js'
import { FIT_PROXY } from '../scoring.js'

const dim = (gv, key) => gv.dimensions.find(d => d.key === key)
const behind = d => d && (d.status === 'shortfall' || d.status === 'critical')
const junior = grade => /9th|10th|11th/i.test(grade || '')

const HONOR_NEXT = { 0: 'regional', 1: 'regional', 2: 'natl', 3: 'intl' }
const HONOR_NEXT_LABEL = { regional: 'regional', natl: 'national', intl: 'international' }

const TECH_RE = /(computer|software|engineer|data science|mathemat|physics|robot|technolog|informat|electric|mechanic|aerospace|artificial intelligence)/i

// Evidence vocabulary per major family. A declared major counts as "visible"
// in the file when any kin token appears in an activity or honor — raw word
// overlap alone would flag a robotics-club founder applying for CS as
// incoherent. Tokens are lowercase substrings, deliberately generous: this
// rule should only fire when a major is genuinely invisible in the file.
const MAJOR_KIN = [
  [/comput|software|informat|data|artificial|cyber/i, ['comput', 'software', 'coding', 'code', 'program', 'robot', 'app', 'website', 'hackathon', 'informat', 'tech', 'algorithm', 'develop']],
  [/engineer|mechanic|electric|aerospace|civil/i, ['engineer', 'robot', 'built', 'build', 'design', 'arduino', '3d', 'circuit', 'machine']],
  [/math/i, ['math', 'olympiad', 'statistic', 'logic']],
  [/physic|astro/i, ['physic', 'astro', 'olympiad', 'science']],
  [/biolog|medic|health|nurs|pharma|chem/i, ['bio', 'chem', 'medic', 'health', 'hospital', 'clinic', 'lab', 'science', 'doctor', 'patient']],
  [/business|financ|econom|account|market|entrepreneur|management/i, ['business', 'startup', 'entrepreneur', 'financ', 'econom', 'market', 'sell', 'sold', 'company', 'invest', 'profit', 'shop']],
  [/politic|international relations|law|policy|government/i, ['debate', 'model un', 'mun', 'politic', 'law', 'policy', 'government', 'parliament', 'diplom']],
  [/psycholog|sociolog|anthropolog/i, ['psycholog', 'sociolog', 'community', 'survey', 'research', 'volunteer']],
  [/art|design|music|film|theat|writing|literature|journal/i, ['art', 'design', 'music', 'film', 'theat', 'paint', 'draw', 'wrote', 'writing', 'journal', 'photograph', 'perform', 'exhibit', 'newspaper', 'magazine']],
  [/educat|teach/i, ['teach', 'tutor', 'mentor', 'educat', 'school']],
  [/environment|sustain|ecolog|earth/i, ['environment', 'sustain', 'ecolog', 'climate', 'recycl', 'clean', 'green', 'planting']],
]

function majorEvidenceTokens(majors) {
  const tokens = new Set()
  for (const m of majors) {
    for (const w of m.toLowerCase().split(/[^a-z]+/)) if (w.length >= 4) tokens.add(w)
    for (const [re, kin] of MAJOR_KIN) if (re.test(m)) kin.forEach(k => tokens.add(k))
  }
  return [...tokens]
}

export const RULES = [
  {
    id: 'GATE_BLOCKED',
    dimension: 'institutionalGates',
    when: ({ gv }) => gv.gates.satMinimum.applies && !gv.gates.satMinimum.met,
    build: ({ gv, profile }) => {
      const required = gv.gates.satMinimum.required
      const current = parseInt(profile.testScores?.sat) || 0
      return {
        title: `Clear the hard SAT requirement: ${required}`,
        actionSkeleton: `${gv.collegeName} enforces a firm SAT minimum of ${required} for applicants like you${current ? ` — you are at ${current}, ${required - current} points short` : ' — no score is on file'}. Until that bar is cleared, nothing else in the application is evaluated. Structured prep targeting ${required}+ is the gating action for this school.`,
        rationale: `Hard institutional requirement: SAT minimum ${required}.`,
        mutations: current ? [{ type: 'sat', value: required }] : null,
        clearsGate: true,
        effortWeeks: 8,
        effortLabel: '6–10 weeks structured prep',
        deadlineAnchor: 'testing',
      }
    },
  },
  {
    id: 'SAT_BELOW_P25',
    dimension: 'testing',
    when: ({ gv }) => {
      const t = dim(gv, 'testing')
      return t && typeof t.studentValue === 'number' && t.benchmark?.p25 != null && t.delta < 0
    },
    build: ({ gv }) => {
      const t = dim(gv, 'testing')
      const target = t.benchmark.p50
      return {
        title: `Retake the SAT, target ${target}+`,
        actionSkeleton: `Your ${t.studentValue} sits ${-t.delta} points below the 25th percentile of admitted students (${t.benchmark.p25}) — the band where a score stops being neutral and starts costing you. A retake targeting the admitted median of ${target} is the single most direct move available.`,
        rationale: t.evidence,
        mutations: [{ type: 'sat', value: target }],
        effortWeeks: 7,
        effortLabel: '6–8 weeks structured prep',
        deadlineAnchor: 'testing',
      }
    },
  },
  {
    id: 'SAT_P25_TO_P50',
    dimension: 'testing',
    when: ({ gv }) => {
      const t = dim(gv, 'testing')
      return t && typeof t.studentValue === 'number' && t.benchmark?.p50 != null
        && t.studentValue >= t.benchmark.p25 && t.studentValue < t.benchmark.p50
    },
    build: ({ gv }) => {
      const t = dim(gv, 'testing')
      const target = t.benchmark.p75
      return {
        title: `Optional: push the SAT toward ${target}`,
        actionSkeleton: `Your ${t.studentValue} is inside the admitted range but below the median of ${t.benchmark.p50}. It will not sink the application; moving toward the 75th percentile (${target}) converts testing from neutral to an asset. Worth doing only if it does not crowd out higher-leverage work below.`,
        rationale: t.evidence,
        mutations: [{ type: 'sat', value: target }],
        effortWeeks: 6,
        effortLabel: '5–7 weeks of targeted prep',
        deadlineAnchor: 'testing',
      }
    },
  },
  {
    id: 'TEST_OPTIONAL_ARBITRAGE',
    dimension: 'strategy',
    when: ({ gv, profile, resolved }) => {
      const t = dim(gv, 'testing')
      const g = dim(gv, 'gpa')
      return resolved.admissions?.testPolicy === 'optional'
        && t && typeof t.studentValue === 'number' && t.delta != null && t.delta < 0
        && g && (g.status === 'at-par' || g.status === 'surplus')
        && !junior(profile.grade)   // juniors have time to fix the score instead
    },
    build: ({ gv }) => {
      const t = dim(gv, 'testing')
      return {
        title: 'Consider applying test-optional here',
        actionSkeleton: `${gv.collegeName} is test-optional, your GPA stands at or above the admitted profile, and your SAT (${t.studentValue}) sits below their 25th percentile with little runway left to retake. Withholding the score makes the file lead with its strongest numbers. Note the trade-off for international applicants: a strong score is extra evidence of academic readiness, so withhold only if a retake is genuinely off the table.`,
        rationale: `${t.evidence}; GPA at/above the admitted profile; test-optional policy.`,
        mutations: null,
        effortWeeks: 0,
        effortLabel: 'A strategy decision, not a workload',
        deadlineAnchor: 'application',
      }
    },
  },
  {
    id: 'GPA_SHORTFALL',
    dimension: 'gpa',
    when: ({ gv, profile }) => behind(dim(gv, 'gpa')) && junior(profile.grade),
    build: ({ gv, resolved }) => {
      const g = dim(gv, 'gpa')
      const target = g.benchmark.mean
      const progs = (resolved.school.strongPrograms || []).slice(0, 2)
      return {
        title: `Push the GPA toward ${target.toFixed(2)} over the remaining terms`,
        actionSkeleton: `Your normalized GPA of ${g.studentValue.toFixed(2)}/4 trails this school's admitted profile (~${target.toFixed(2)}). You still have terms on the transcript ahead of the application — an upward trend in the final reported terms reads well everywhere${progs.length ? `, and the courses that matter most here are the ones feeding ${progs.join(' and ')}` : ''}.`,
        rationale: g.evidence,
        mutations: [{ type: 'gpaNorm', value: target }],
        effortWeeks: 16,
        effortLabel: 'A school term of consistent execution',
        deadlineAnchor: 'application',
      }
    },
  },
  {
    id: 'RIGOR_GAP',
    dimension: 'rigor',
    when: ({ gv, profile }) => behind(dim(gv, 'rigor')) && junior(profile.grade),
    build: ({ gv, resolved }) => {
      const r = dim(gv, 'rigor')
      const progs = (resolved.school.strongPrograms || []).slice(0, 2)
      return {
        title: 'Add advanced coursework (A-Level / IB / AP) if your school offers it',
        actionSkeleton: `Your file shows ${typeof r.studentValue === 'number' && r.studentValue > 0 ? `${r.studentValue} advanced course unit${r.studentValue === 1 ? '' : 's'}` : 'no advanced curriculum entries'} against roughly ${r.benchmark.expectedUnits} in this school's admitted pool. If your school offers A-Levels, IB, or AP, add the ones nearest ${progs.length ? progs.join(' / ') : 'your intended major'}. If it offers none, say so in the application — admissions offices evaluate rigor within what was available to you, and counselors can document it.`,
        rationale: r.evidence,
        mutations: null,
        effortWeeks: 20,
        effortLabel: 'An academic year of coursework',
        deadlineAnchor: 'application',
      }
    },
  },
  {
    id: 'HONOR_CEILING',
    dimension: 'honors',
    when: ({ gv }) => {
      const h = dim(gv, 'honors')
      const rate = gv.admitRate
      return h && rate != null && rate <= 10 && h.delta <= 0
    },
    build: ({ gv, profile }) => {
      const h = dim(gv, 'honors')
      const ceiling = (profile.honors || []).filter(isRealHonor)
        .reduce((m, x) => Math.max(m, { school: 1, regional: 2, natl: 3, intl: 4 }[x.level] || 0), 0)
      const nextLevel = HONOR_NEXT[Math.min(ceiling, 3)]
      const atPar = h.status === 'at-par'
      return {
        title: `Push your strongest competition result to the ${HONOR_NEXT_LABEL[nextLevel]} level`,
        actionSkeleton: atPar
          ? `Your honor ceiling (${String(h.studentValue).toLowerCase()}) matches this admitted pool — but at a ${gv.admitRate}% admit rate, "at par" is not a differentiator. Converting your strongest existing result into a ${HONOR_NEXT_LABEL[nextLevel]}-level attempt is what moves you from typical to memorable, and it builds on work you have already done.`
          : `Your honor ceiling (${String(h.studentValue).toLowerCase()}) sits below what this admitted pool typically carries. Target the ${HONOR_NEXT_LABEL[nextLevel]} tier of the strongest competition you already compete in — selection cycles for your country and curriculum decide the exact route, so map the qualifying rounds now.`,
        rationale: h.evidence,
        mutations: [{ type: 'addHonor', level: nextLevel, title: `${HONOR_NEXT_LABEL[nextLevel]} competition result (target)` }],
        effortWeeks: 12,
        effortLabel: 'A competition cycle of focused preparation',
        deadlineAnchor: 'application',
      }
    },
  },
  {
    id: 'EC_BREADTH_WITHOUT_DEPTH',
    dimension: 'ecDepth',
    when: ({ gv }) => {
      const b = dim(gv, 'ecBreadth'), d = dim(gv, 'ecDepth')
      return b && d && (b.status === 'at-par' || b.status === 'surplus') && behind(d)
    },
    build: ({ gv, profile }) => {
      const d = dim(gv, 'ecDepth')
      // Name the student's own activities to deepen: the first two real ones
      // that currently carry no leadership/artifact marker.
      const real = (profile.extracurriculars || []).filter(isRealEc)
      const shallow = real.filter(e => ecProfile([e]).deep === 0).slice(0, 2)
      const named = shallow.map(e => `“${e.description.trim().slice(0, 60)}${e.description.trim().length > 60 ? '…' : ''}”`)
      return {
        title: 'Consolidate: take two of your activities deep',
        actionSkeleton: `You have breadth (${dim(gv, 'ecBreadth').studentValue} activities) but this pool rewards depth — ownership, output, scale — and your file currently shows ${d.studentValue.deep} deep item${d.studentValue.deep === 1 ? '' : 's'}. Rather than adding anything new, pick two you already run${named.length ? ` — start with ${named.join(' and ')}` : ''} — and turn them into things with your name on the outcome: lead it, grow it, or produce something visible from it.`,
        rationale: d.evidence,
        mutations: null,
        effortWeeks: 10,
        effortLabel: '8–12 weeks of sustained ownership',
        deadlineAnchor: 'application',
      }
    },
  },
  {
    id: 'TECHNICAL_DEPTH_GAP',
    dimension: 'ecArtifact',
    when: ({ gv, profile, resolved }) => {
      const techSchool = (resolved.school.strongPrograms || []).some(p => TECH_RE.test(p))
      const techMajor = (profile.majors || []).some(m => TECH_RE.test(m))
      return techSchool && techMajor && ecProfile(profile.extracurriculars).withArtifact === 0
    },
    build: ({ gv, profile }) => ({
      title: 'Ship one technical artifact with a public URL',
      actionSkeleton: `You are applying for ${(profile.majors || []).filter(m => TECH_RE.test(m)).join(', ')} at a school whose flagship programs are technical, and nothing in your activities produces a technical output anyone can open. One finished, public artifact — a deployed project, a repository with real commits, a measurable result in a recognized competition — converts “interested in the field” into “already operating in it”. The modeled chance bump below understates this one: it is the difference in what your application *is*, not just a point on a scale.`,
      rationale: `Intended major is technical; strongest programs here are technical; 0 activities carry a technical artifact.`,
      mutations: [{ type: 'addEc', description: 'Shipped a public technical project (deployed app / repository / competition entry) with a verifiable URL (target)' }],
      effortWeeks: 10,
      effortLabel: '8–12 weeks of building',
      deadlineAnchor: 'application',
    }),
  },
  {
    id: 'NARRATIVE_INCOHERENCE',
    dimension: 'narrative',
    when: ({ gv, profile }) => {
      const majors = (profile.majors || []).filter(Boolean)
      if (!majors.length) return false
      const real = (profile.extracurriculars || []).filter(isRealEc)
      const honors = (profile.honors || []).filter(isRealHonor)
      if (real.length + honors.length < 2) return false
      const texts = [...real.map(e => e.description), ...honors.map(h => h.title)].join(' ').toLowerCase()
      const tokens = majorEvidenceTokens(majors)
      return tokens.length > 0 && !tokens.some(tok => texts.includes(tok))
    },
    build: ({ gv, profile }) => {
      const real = (profile.extracurriculars || []).filter(isRealEc)
      const strongest = real.slice(0, 2).map(e => `“${e.description.trim().slice(0, 50)}${e.description.trim().length > 50 ? '…' : ''}”`)
      return {
        title: `Build a visible through-line to ${(profile.majors || [])[0]}`,
        actionSkeleton: `You are applying for ${(profile.majors || []).join(', ')}, but nothing in your activities or honors visibly points there — the reader has to take the interest on faith. Either anchor the story in what you already do${strongest.length ? ` (${strongest.join(', ')} can carry it if you frame the connection)` : ''}, or add one concrete item that makes the intended major legible. Coherence is free chance: it changes how every other line in the file reads.`,
        rationale: 'Declared major shares no vocabulary with any listed activity or honor.',
        mutations: null,
        effortWeeks: 3,
        effortLabel: '2–4 weeks of reframing and one small addition',
        deadlineAnchor: 'application',
      }
    },
  },
  {
    id: 'AID_SHORTFALL',
    dimension: 'financialFeasibility',
    when: ({ gv }) => behind(dim(gv, 'financialFeasibility')),
    build: ({ gv, profile, resolved, data }) => {
      const f = dim(gv, 'financialFeasibility')
      // Comparable-fit, fully fundable alternatives from our own dataset:
      // financially eligible, similar selectivity, ranked by major match.
      const rate = gv.admitRate ?? 25
      const alternatives = data.financial
        .filter(fin => fin.id !== gv.collegeId && isFinanciallyEligible(profile.efc, fin))
        .map(fin => {
          const fiske = data.schoolsById[FIT_PROXY[fin.id] || fin.id]
          if (!fiske) return null
          const merged = { ...fiske, id: fin.id, name: fin.name }
          const r = admitRate(merged)
          if (r == null || r < rate - 8 || r > rate + 18) return null
          return { id: fin.id, name: fin.name, admitRate: r, majorFit: majorMatches(profile.majors, merged) }
        })
        .filter(Boolean)
        .sort((a, b) => (b.majorFit - a.majorFit) || (Math.abs(a.admitRate - rate) - Math.abs(b.admitRate - rate)) || a.id.localeCompare(b.id))
        .slice(0, 3)
      return {
        title: 'Face the aid gap now, not at the offer stage',
        actionSkeleton: `${f.evidence}. Two honest moves: pursue this school's own competitive scholarships and external awards early (their deadlines usually precede admission deadlines), and hold comparable schools where the money actually works${alternatives.length ? ` — from our data: ${alternatives.map(a => a.name).join(', ')}` : ''}. Applying only to under-funded reaches is how strong students end up with offers they cannot take.`,
        rationale: f.evidence,
        mutations: null,
        alternatives,
        effortWeeks: 2,
        effortLabel: 'A focused research-and-shortlist pass',
        deadlineAnchor: 'application',
      }
    },
  },
  {
    id: 'NEED_BLIND_OPPORTUNITY',
    dimension: 'financialStrategy',
    when: ({ gv, profile }) => gv.gates.needBlind.applies && profile.efc <= 40000,
    build: ({ gv }) => ({
      title: 'Prioritize this application — the aid policy is structurally on your side',
      actionSkeleton: `${gv.collegeName} is need-blind for international applicants: your family's finances play no role in the decision, and demonstrated need is met. For your budget bracket that is a structural advantage almost no US school offers — give this application your best work and your earliest deadline discipline.`,
      rationale: 'Need-blind policy + high-need bracket.',
      mutations: null,
      effortWeeks: 0,
      effortLabel: 'Prioritization, not extra work',
      deadlineAnchor: 'application',
    }),
  },
  {
    id: 'ED_LEVERAGE',
    dimension: 'strategy',
    when: ({ gv, resolved }) => {
      const ed = resolved.admissions?.decisionPlans?.ed
      const eligible = gv.gates.financialFilter.passed
      return !!ed?.offered && gv.chance >= 35 && gv.chance <= 60 && eligible === true
    },
    build: ({ gv, resolved }) => {
      const ed = resolved.admissions.decisionPlans.ed
      const rateLine = ed.admitRate != null && gv.admitRate != null
        ? `Its ED round admits at ~${Math.round(ed.admitRate * 100)}% against ~${gv.admitRate}% overall — a real, published gap.`
        : `ED rounds at schools like this historically admit at a materially higher rate than the regular pool.`
      return {
        title: `Apply Early Decision${ed.deadline ? ` (deadline ${ed.deadline.replace('-', '/')})` : ''}`,
        actionSkeleton: `First, the caveat that outranks the odds: ED is binding, so it is only on the table because the aid math here works for your bracket — verify the family is genuinely comfortable before committing. That said: you sit in the band where an early commitment matters most (modeled chance ${gv.chance}). ${rateLine} Committing your one ED card here converts real admissions value.`,
        rationale: `Chance ${gv.chance} in the 35–60 band; ED offered; financially eligible.`,
        mutations: null,
        effortWeeks: 1,
        effortLabel: 'A decision plus earlier essay deadlines',
        deadlineAnchor: 'ed',
      }
    },
  },
  {
    id: 'DEMONSTRATED_INTEREST',
    dimension: 'interest',
    when: ({ resolved }) => resolved.admissions?.demonstratedInterest === true,
    build: ({ gv }) => ({
      title: 'Log demonstrated interest — this school tracks it',
      actionSkeleton: `${gv.collegeName} formally considers demonstrated interest. For an international applicant that means the trackable kinds: open and click their emails, attend a virtual session or international webinar, request contact with the regional admissions officer, and mention specific programs in the "Why us" writing. Thirty minutes a month, logged from now until you submit.`,
      rationale: 'CDS-reported: level of applicant interest is considered.',
      mutations: null,
      effortWeeks: 1,
      effortLabel: 'Low — steady small touches',
      deadlineAnchor: 'application',
    }),
  },
]

// CEILING_REACHED is not in the table above because it fires on the ABSENCE of
// gaps: when nothing meaningful remains, the plan must say so rather than
// manufacture work — that honesty is what makes the other reports credible.
export function ceilingPrescription(gv) {
  return {
    ruleId: 'CEILING_REACHED',
    dimension: 'ceiling',
    title: 'Your profile is competitive — protect it and execute',
    actionSkeleton: `No meaningful measurable gap remains between your profile and this school's admitted pool. At a ${gv.admitRate != null ? `${gv.admitRate}%` : 'highly selective'} admit rate the remaining variance is essays, recommendations, and fit — the parts only you can write. Do not manufacture new activities for the sake of it; depth already achieved beats breadth added late.`,
    rationale: 'All measured dimensions at or above the admitted profile.',
    modeled: false,
    mutations: null,
    deltaChance: null,
    chanceAfter: null,
    effortWeeks: 0,
    effortLabel: 'Focus, not additions',
    deadlineAnchor: 'application',
  }
}

// Run the catalogue. Returns raw prescriptions (unranked, unsimulated).
export function matchRules(gv, profile, resolved, data) {
  const ctx = { gv, profile, resolved, data }
  const out = []
  for (const rule of RULES) {
    try {
      if (rule.when(ctx)) out.push({ ruleId: rule.id, dimension: rule.dimension, ...rule.build(ctx) })
    } catch (err) {
      // A rule bug must never take down report generation — skip and log.
      console.error(`[report] rule ${rule.id} failed:`, err.message)
    }
  }
  return out
}
