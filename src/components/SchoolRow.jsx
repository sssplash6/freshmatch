import { useEffect, useState } from 'react'
import { schoolBadge } from '../data/schoolLogos'

// One recommended-school row: logo chip (or monogram fallback) + name.
// `accent` (best-fit) tints the monogram badge orange.
export default function SchoolRow({ name, accent = false, delay = 0 }) {
  const { slug, monogram } = schoolBadge(name)
  const [logoSrc, setLogoSrc] = useState(null)

  useEffect(() => {
    if (!slug) return
    let alive = true
    const base = `${import.meta.env.BASE_URL}logos/${slug}`
    const attempt = (ext, next) => {
      const img = new Image()
      img.onload = () => { if (alive) setLogoSrc(`${base}.${ext}`) }
      img.onerror = next
      img.src = `${base}.${ext}`
    }
    attempt('svg', () => attempt('png', () => {}))
    return () => { alive = false }
  }, [slug])

  return (
    <div className={`result-school${accent ? ' accent' : ''}`} style={{ animationDelay: `${delay}ms` }}>
      <span className={`result-badge ${logoSrc ? 'logo' : 'mono'}`}>
        {logoSrc ? <img src={logoSrc} alt="" /> : monogram}
      </span>
      <span className="result-school-name">{name}</span>
    </div>
  )
}
