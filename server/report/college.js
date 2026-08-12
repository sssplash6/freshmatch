// Resolve a college id into the merged view the report engine works on:
// Fiske editorial profile (branch campuses proxy their parent's, same as the
// match pipeline), financial entry, and admitted-student benchmarks.
import { FIT_PROXY } from '../scoring.js'

// Returns { school, fin, admissions } or null when the id is unknown.
// `school` is the same merged shape narrate.js builds: Fiske profile with the
// branch campus's own id/name/aid economics layered on top.
export function resolveCollege(collegeId, { schoolsById, finById, admissionsById }) {
  const fin = finById[collegeId] || null
  const fiske = schoolsById[FIT_PROXY[collegeId] || collegeId] || null
  if (!fin && !fiske) return null

  const school = fiske
    ? { ...fiske, id: collegeId, name: fin?.name || fiske.name, avgAid: fin?.avgAid ?? null, noAid: fin?.noAid ?? false }
    : { id: collegeId, name: fin.name, avgAid: fin.avgAid ?? null, noAid: fin.noAid ?? false }

  return { school, fin, admissions: admissionsById[collegeId] || null }
}
