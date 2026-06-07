const META = {
  'harvard':         { slug: 'harvard',   monogram: 'H'    },
  'yale':            { slug: 'yale',      ext: 'svg', monogram: 'Y'    },
  'princeton':       { slug: 'princeton', monogram: 'Pr'   },
  'columbia':        { slug: 'columbia',  monogram: 'Co'   },
  'upenn':           { slug: 'upenn',     monogram: 'P'    },
  'brown':           { slug: 'brown',     monogram: 'Br'   },
  'cornell':         { slug: 'cornell',   monogram: 'Cor'  },
  'mit':             { slug: 'mit',       monogram: 'MIT'  },
  'stanford':        { slug: 'stanford',  monogram: 'S'    },
  'caltech':         { slug: 'caltech',   monogram: 'Ct'   },
  'carnegie-mellon': { slug: 'cmu',       monogram: 'CMU'  },
  'uchicago':        { slug: 'uchicago',  monogram: 'UC'   },
  'berkeley':        { slug: 'berkeley',  monogram: 'Cal'  },
  'nyuad':           { slug: 'nyuad',     monogram: 'NYUAD'},
  'nyush':           { monogram: 'NYUSH'},
  'cmu-q':           { slug: 'cmu',       monogram: 'CMU-Q'},
}

function deriveMonogram(name) {
  const words = name
    .replace(/\(.*?\)/g, '')
    .split(/\s+/)
    .filter(w => w && !/^(of|the|and|university|college|at|in)$/i.test(w))
  const letters = words.map(w => w[0]).join('').slice(0, 3)
  return (letters || name.slice(0, 2)).toUpperCase()
}

export function schoolBadge(id, name) {
  const meta = META[id]
  if (meta) {
    const path = meta.slug ? `/logos/${meta.slug}.${meta.ext || 'png'}` : null
    return { path, monogram: meta.monogram }
  }
  return { path: null, monogram: deriveMonogram(name || id || '') }
}
