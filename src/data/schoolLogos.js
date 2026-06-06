// Maps each school the calculator can output to a logo slug (a file in
// /public/logos) and a short monogram used for the seal fallback when no logo
// file exists. Keep in sync with BASE_SCHOOLS / ADJUSTED_SCHOOLS in scoring.js.
const META = {
  'MIT':                        { slug: 'mit',       monogram: 'MIT' },
  'Caltech':                    { slug: 'caltech',   monogram: 'Ct' },
  'Carnegie Mellon University': { slug: 'cmu',       monogram: 'CMU' },
  'Georgia Tech':               { monogram: 'GT' },
  'Cornell Engineering':        { slug: 'cornell',   monogram: 'Cor' },
  'Harvard University':         { slug: 'harvard',   monogram: 'H' },
  'Yale University':            { slug: 'yale',      monogram: 'Y' },
  'Princeton University':       { slug: 'princeton', monogram: 'Pr' },
  'Columbia University':        { slug: 'columbia',  monogram: 'Co' },
  'Columbia University (Core)': { slug: 'columbia',  monogram: 'Co' },
  'UPenn':                      { slug: 'upenn',     monogram: 'P' },
  'UPenn Wharton':              { slug: 'upenn',     monogram: 'P' },
  'University of Chicago':      { slug: 'uchicago',  monogram: 'UC' },
  'Brown University':           { slug: 'brown',     monogram: 'Br' },
  'Stanford University':        { slug: 'stanford',  monogram: 'S' },
  'UC Berkeley':                { slug: 'berkeley',  monogram: 'Cal' },
  'Babson College':            { monogram: 'Ba' },
  'CMU-Q':                     { monogram: 'CMQ' },
  'NYUAD':                      { slug: 'nyuad',     monogram: 'NYU' },
  'Harvey Mudd College':       { monogram: 'HM' },
  'Cooper Union':              { monogram: 'CU' },
  'DKU':                       { monogram: 'DKU' },
  'NYUSH':                     { monogram: 'NSH' },
  'GU-Q':                      { monogram: 'GUQ' },
  'Colby College':             { monogram: 'Cby' },
  'Lafayette College':         { monogram: 'Laf' },
  'Yonsei University':         { monogram: 'Yon' },
  'Hamilton College':          { monogram: 'Ham' },
}

// Fallback for any school not explicitly mapped: initials of significant words.
function deriveMonogram(name) {
  const words = name
    .replace(/\(.*?\)/g, '')
    .split(/\s+/)
    .filter(w => w && !/^(of|the|and|university|college)$/i.test(w))
  const letters = words.map(w => w[0]).join('').slice(0, 3)
  return (letters || name.slice(0, 2)).toUpperCase()
}

export function schoolBadge(name) {
  const meta = META[name]
  if (meta) return { slug: meta.slug ?? null, monogram: meta.monogram }
  return { slug: null, monogram: deriveMonogram(name) }
}
