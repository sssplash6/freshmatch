import { useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useSpring, useReducedMotion } from 'framer-motion'

const ENTRANCE = { duration: 0.6, ease: [0.22, 1, 0.36, 1] }

const SEAL_TICKS = Array.from({ length: 36 }, (_, i) => {
  const a = (i / 36) * Math.PI * 2
  return {
    x1: 60 + Math.cos(a) * 57,
    y1: 60 + Math.sin(a) * 57,
    x2: 60 + Math.cos(a) * 52,
    y2: 60 + Math.sin(a) * 52,
  }
})

// Monochrome university seal: engraved tick ring + serif monogram. Fallback for
// any school whose real logo file isn't present yet.
function SealLogo({ monogram, name, accent }) {
  const fontSize = monogram.length <= 1 ? 42 : monogram.length === 2 ? 33 : 25
  return (
    <svg
      viewBox="0 0 120 120"
      className={`fs-seal${accent ? ' fs-seal-accent' : ''}`}
      role="img"
      aria-label={name}
    >
      <circle cx="60" cy="60" r="57" className="fs-seal-ring-outer" />
      {SEAL_TICKS.map((t, i) => (
        <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} className="fs-seal-tick" />
      ))}
      <circle cx="60" cy="60" r="46" className="fs-seal-ring-inner" />
      <text
        x="60"
        y="61"
        className="fs-seal-mono"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
      >
        {monogram}
      </text>
    </svg>
  )
}

// A single card in the fixed pattern: cursor-repel (spring) + slow idle drift.
function SchoolCard({ school, index, mouseX, mouseY, reduce }) {
  const ref = useRef(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const springX = useSpring(x, { stiffness: 265, damping: 20 })
  const springY = useSpring(y, { stiffness: 265, damping: 20 })

  useEffect(() => {
    if (reduce) return
    const handleMouseMove = () => {
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const dx = mouseX.current - (rect.left + rect.width / 2)
      const dy = mouseY.current - (rect.top + rect.height / 2)
      const distance = Math.hypot(dx, dy)
      const radius = 158
      if (distance < radius) {
        const angle = Math.atan2(dy, dx)
        const force = (1 - distance / radius) * 41
        x.set(-Math.cos(angle) * force)
        y.set(-Math.sin(angle) * force)
      } else {
        x.set(0)
        y.set(0)
      }
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [reduce, x, y, mouseX, mouseY])

  // Real logo from /public/logos/<slug>.(svg|png); seal until one loads.
  const [logoSrc, setLogoSrc] = useState(null)
  useEffect(() => {
    if (!school.slug) return
    let alive = true
    const base = `${import.meta.env.BASE_URL}logos/${school.slug}`
    const attempt = (ext, next) => {
      const img = new Image()
      img.onload = () => { if (alive) setLogoSrc(`${base}.${ext}`) }
      img.onerror = next
      img.src = `${base}.${ext}`
    }
    attempt('svg', () => attempt('png', () => {}))
    return () => { alive = false }
  }, [school.slug])

  // Per-card wandering drift — varied amplitude/direction so the field feels
  // alive and unsynced (deterministic from index; stays within card spacing).
  const dir = index % 2 === 0 ? 1 : -1
  const ax = (4 + (index % 4) * 1) * dir   // ±4..7
  const ay = 9 + (index % 5) * 1.5         // 9..15
  const rot = (2.5 + (index % 3) * 0.75) * dir
  const floatAnim = {
    x: [0, ax, -ax * 0.5, ax * 0.7, 0],
    y: [0, -ay, ay * 0.55, -ay * 0.7, 0],
    rotate: [0, rot, -rot * 0.6, rot * 0.4, 0],
  }
  const floatTransition = {
    duration: 5.5 + ((index * 7) % 11) * 0.4, // ~5.5..9.5s
    repeat: Infinity,
    ease: 'easeInOut',
    times: [0, 0.25, 0.5, 0.75, 1],
  }

  const tileClass = logoSrc ? 'fs-chip' : `fs-card${school.accent ? ' fs-card-accent' : ''}`

  return (
    <motion.div
      ref={ref}
      style={{ ...school.pos, x: reduce ? 0 : springX, y: reduce ? 0 : springY }}
      initial={reduce ? false : { opacity: 0, scale: 0.6 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
      transition={{ ...ENTRANCE, delay: reduce ? 0 : index * 0.05 }}
      className="fs-body"
    >
      <motion.div
        className={tileClass}
        animate={reduce ? {} : floatAnim}
        transition={floatTransition}
      >
        {logoSrc ? (
          <img className="fs-logo-img" src={logoSrc} alt={school.name} />
        ) : (
          <SealLogo monogram={school.monogram} name={school.name} accent={school.accent} />
        )}
      </motion.div>
    </motion.div>
  )
}

export default function FloatingSchools({
  brand,
  eyebrow,
  title,
  titleAccent,
  subtitle,
  ctaText,
  onCta,
  meta,
  schools,
}) {
  const reduce = useReducedMotion()
  const [isMobile, setIsMobile] = useState(false)
  const mouseX = useRef(0)
  const mouseY = useRef(0)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const sync = () => setIsMobile(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const visible = schools.filter((s) => !(isMobile && s.hideSm))

  const handleMouseMove = (event) => {
    mouseX.current = event.clientX
    mouseY.current = event.clientY
  }

  const reveal = (delay) => ({
    initial: reduce ? false : { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { ...ENTRANCE, delay: reduce ? 0 : delay },
  })

  return (
    <section className="landing" onMouseMove={reduce ? undefined : handleMouseMove}>
      <div className="fs-brand">{brand}</div>

      <div className="fs-field" aria-hidden="true">
        {visible.map((school, i) => (
          <SchoolCard
            key={school.id}
            school={school}
            index={i}
            mouseX={mouseX}
            mouseY={mouseY}
            reduce={reduce}
          />
        ))}
      </div>

      <div className="fs-content">
        <motion.p className="fs-eyebrow" {...reveal(0.15)}>{eyebrow}</motion.p>
        <motion.h1 className="fs-title" {...reveal(0.24)}>
          {title} <em>{titleAccent}</em>
        </motion.h1>
        {subtitle && <motion.p className="fs-sub" {...reveal(0.34)}>{subtitle}</motion.p>}
        <motion.div className="fs-cta-row" {...reveal(0.44)}>
          <button className="fs-cta" onClick={onCta}>{ctaText}</button>
          <p className="fs-meta">{meta}</p>
        </motion.div>
      </div>
    </section>
  )
}
