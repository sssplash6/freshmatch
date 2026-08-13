// Counterfactual simulation — the headline mechanic.
//
// Because academicStrength / dreamChanceScore / dreamFinancialPenalty are pure,
// "what happens to this student's odds if they do X?" is answered by re-running
// them on a mutated copy of the profile. Zero tokens, microseconds, perfectly
// reproducible. Mutations are a closed, whitelisted set — nothing else about
// the profile can be touched, so a simulated chance is always comparable to
// the baseline.
//
// Honesty rule: only actions the strength composite actually scores (SAT band,
// GPA band, honor points, activity count) are simulated. Strategic actions the
// model doesn't quantify carry no invented delta — the plan says so plainly.
import { academicStrength, dreamChanceScore, dreamFinancialPenalty } from '../scoring.js'

// Supported ops:
//   { type: 'sat',      value: 1530 }
//   { type: 'gpaNorm',  value: 3.9 }                    // target on the /4 scale
//   { type: 'addHonor', level: 'intl', title: '…' }
//   { type: 'addEc',    description: '…' }
export function applyMutations(profile, mutations) {
  const after = {
    ...profile,
    testScores: { ...(profile.testScores || {}) },
    honors: [...(profile.honors || [])],
    extracurriculars: [...(profile.extracurriculars || [])],
  }
  for (const m of mutations || []) {
    if (m.type === 'sat') {
      after.testScores.sat = String(m.value)
    } else if (m.type === 'gpaNorm') {
      // Express the /4 target back in the student's own scale so the
      // composite's normalization reads it exactly as intended.
      const scale = parseFloat(after.testScores.gpaScale) || 4
      after.testScores.gpa = String(Math.min((m.value / 4) * scale, scale))
    } else if (m.type === 'addHonor') {
      after.honors = [...after.honors, { title: m.title || 'Target honor (simulated)', level: m.level }]
    } else if (m.type === 'addEc') {
      after.extracurriculars = [...after.extracurriculars, { description: m.description }]
    }
  }
  return after
}

// Chance for a profile at a school — the exact formula the match pipeline uses
// for dream schools, kept in one place so report numbers can never drift from
// product numbers.
export function chanceFor(profile, { school, fin }) {
  const strength = academicStrength(profile.testScores, profile.honors, profile.extracurriculars)
  const chance = Math.max(5, Math.round(dreamChanceScore(strength, school) * dreamFinancialPenalty(profile.efc, fin)))
  return { strength, chance }
}

// Simulate one set of mutations against a baseline.
export function simulate(profile, resolved, mutations, baseline = chanceFor(profile, resolved)) {
  const after = applyMutations(profile, mutations)
  const { strength, chance } = chanceFor(after, resolved)
  return {
    strength,
    chance,
    delta: chance - baseline.chance,
    baseline: { strength: baseline.strength, chance: baseline.chance },
  }
}
