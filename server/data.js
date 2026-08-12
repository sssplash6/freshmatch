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
    const [rawSchools, rawFinancial] = await Promise.all([
      readFile(join(DATA, 'schools.json'), 'utf8'),
      readFile(join(DATA, 'schools-financial.json'), 'utf8'),
    ])
    const schools = JSON.parse(rawSchools)
    const financial = JSON.parse(rawFinancial)
    cache = {
      schools,
      financial,
      schoolsById: Object.fromEntries(schools.map(s => [s.id, s])),
      finById: Object.fromEntries(financial.map(f => [f.id, f])),
    }
  }
  return cache
}
