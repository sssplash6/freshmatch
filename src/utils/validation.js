// Heuristics to reject junk / low-effort free-text before it reaches scoring.
// Submissions like "Jjj" honors, "H"/"B" activities, "Dd" schools, and "Jj"
// essays were passing straight through and inflating fit scores. These guards
// only judge *non-empty* values — empty is still allowed where a field is
// optional.

// Real text is at least `minChars` long and not a single character repeated
// ("Jjj", "aaaa", "...."). Whitespace is ignored when counting distinct chars.
export function hasSubstance(value, minChars = 3) {
  const s = (value || '').trim()
  if (s.length < minChars) return false
  const distinct = new Set(s.replace(/\s+/g, '').toLowerCase()).size
  return distinct >= 2
}

export const MIN_HONOR_CHARS  = 3   // acronyms like "AMC" are fine
export const MIN_EC_CHARS     = 12  // activities should describe scale/impact
export const MIN_SCHOOL_CHARS = 3
export const MIN_ESSAY_CHARS  = 80  // below this we treat the essay as skipped

export const isValidHonorTitle = v => hasSubstance(v, MIN_HONOR_CHARS)
export const isSubstantiveEc    = v => hasSubstance(v, MIN_EC_CHARS)
export const isValidSchoolName  = v => hasSubstance(v, MIN_SCHOOL_CHARS)
export const isRealEssay        = v => (v || '').trim().length >= MIN_ESSAY_CHARS

// Numeric score bounds. "N/A" / "none" / "-" / blank are always allowed — many
// students legitimately don't have a given score. Out-of-range numbers
// (SAT 9999, GPA 99/4, IELTS 50) are rejected so they can't inflate scoring.
const NA_RE = /^\s*(n\s*\/?\s*a|none|-)?\s*$/i
function inRange(value, min, max) {
  const s = String(value ?? '').trim()
  if (NA_RE.test(s)) return true
  const n = parseFloat(s.replace(/[^0-9.]/g, ''))
  if (!Number.isFinite(n)) return false
  return n >= min && n <= max
}

export const isValidSat   = v => inRange(v, 400, 1600)
export const isValidIelts = v => inRange(v, 0, 9)
export const isValidGpa   = (v, scale) => inRange(v, 0, parseFloat(scale) || 4)
