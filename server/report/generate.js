// Report orchestration: profile + collegeId → { gapVector, plan, prose }.
// The route layer stays thin; everything content-shaped happens here.
import { loadData } from '../data.js'
import { resolveCollege } from './college.js'
import { buildGapVector } from './gapVector.js'
import { buildPlan } from './plan.js'
import { composeProse, fallbackProse } from './compose.js'
import { ENGINE_VERSION } from './version.js'

// opts:
//   fitScore — band-locked fit judgment from a match run, when the caller has one
//   now      — clock injection; frozen into the report for determinism
//   compose  — false skips the LLM entirely (zero tokens, deterministic prose)
export async function generateReport(profile, collegeId, { fitScore = null, now = new Date(), compose = true } = {}) {
  const data = await loadData()
  const resolved = resolveCollege(collegeId, data)
  if (!resolved) return null

  const gapVector = buildGapVector(profile, resolved, { fitScore })
  const plan = buildPlan(gapVector, profile, resolved, data, { now })
  const { prose, source } = compose
    ? await composeProse(profile, gapVector, plan, resolved)
    : { prose: fallbackProse(gapVector, plan, profile, resolved), source: 'fallback' }

  return {
    engineVersion: ENGINE_VERSION,
    generatedAt: now.toISOString().slice(0, 10),
    student: {
      name: (profile.name || '').trim() || 'Student',
      grade: profile.grade || null,
      country: profile.country || null,
    },
    profileEfc: profile.efc,
    college: {
      id: resolved.school.id,
      name: resolved.school.name,
    },
    gapVector,
    plan,
    prose,
    proseSource: source,
    admissions: resolved.admissions,
    school: resolved.school,
    fin: resolved.fin,
  }
}
