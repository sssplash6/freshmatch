// School data loading — one place, one in-process cache.
//
// Loaded once per server process. Restart the server after editing JSON data
// files. Shared by the match pipeline and the Per-College Report engine.
import { readFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const DATA = join(__dir, 'data')

let cache = null

export async function loadData() {
  if (!cache) {
    const [rawSchools, rawFinancial, rawAdmissions] = await Promise.all([
      readFile(join(DATA, 'schools.json'), 'utf8'),
      readFile(join(DATA, 'schools-financial.json'), 'utf8'),
      readFile(join(DATA, 'schools-admissions.json'), 'utf8'),
    ])
    const schools = JSON.parse(rawSchools)
    const financial = JSON.parse(rawFinancial)
    const admissionsFile = JSON.parse(rawAdmissions)
    // Stamp the file-level defaults onto each entry so consumers see complete,
    // self-describing records (per-entry sources/asOf override when present).
    const { asOf, defaultSources } = admissionsFile.meta
    const admissions = admissionsFile.schools.map(a => ({ sources: defaultSources, asOf, ...a }))
    cache = {
      schools,
      financial,
      admissions,
      schoolsById: Object.fromEntries(schools.map(s => [s.id, s])),
      finById: Object.fromEntries(financial.map(f => [f.id, f])),
      admissionsById: Object.fromEntries(admissions.map(a => [a.id, a])),
    }
  }
  return cache
}
