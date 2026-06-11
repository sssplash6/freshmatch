import { motion } from 'framer-motion'
import '../styles/PersonalityBadge.css'

// Custom line-icons (24×24, currentColor stroke) — one per personality type.
const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }

const ICONS = {
  'true-freshman': (
    <svg viewBox="0 0 24 24" {...S}>
      <path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8-4.3-4.1 5.9-.9z" />
    </svg>
  ),
  engineer: (
    <svg viewBox="0 0 24 24" {...S}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </svg>
  ),
  programming: (
    <svg viewBox="0 0 24 24" {...S}>
      <path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" />
    </svg>
  ),
  scientist: (
    <svg viewBox="0 0 24 24" {...S}>
      <path d="M9 3h6M10 3v6.5L5 18a2 2 0 001.8 3h10.4A2 2 0 0019 18l-5-8.5V3" />
      <path d="M7.5 14h9" />
    </svg>
  ),
  environmentalist: (
    <svg viewBox="0 0 24 24" {...S}>
      <path d="M11 20A7 7 0 014 13c0-4 3-8 9-9 1 5-1 8.5-4 10" />
      <path d="M11 20c0-4 2-7 6-8" />
    </svg>
  ),
  business: (
    <svg viewBox="0 0 24 24" {...S}>
      <path d="M3 20h18M6 20v-6M11 20V8M16 20v-9M21 20V5" />
      <path d="M4 11l5-5 4 3 7-7" />
    </svg>
  ),
  'social-scientist': (
    <svg viewBox="0 0 24 24" {...S}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18" />
    </svg>
  ),
  humanitarian: (
    <svg viewBox="0 0 24 24" {...S}>
      <path d="M12 3v18M5 6h6c1.5 0 2 .8 2 2M19 6h-6" />
      <path d="M5 6L2.5 12a3 3 0 005 0zM19 6l2.5 6a3 3 0 01-5 0z" />
      <path d="M8 21h8" />
    </svg>
  ),
  artistic: (
    <svg viewBox="0 0 24 24" {...S}>
      <path d="M12 3a9 9 0 000 18c1.2 0 2-.9 2-2 0-.5-.2-.9-.5-1.2-.3-.4-.5-.8-.5-1.3 0-1 .8-1.8 1.8-1.8H17a4 4 0 004-4c0-4.4-4-7.7-9-7.7z" />
      <circle cx="8" cy="11" r="1" /><circle cx="12" cy="8" r="1" /><circle cx="16" cy="11" r="1" />
    </svg>
  ),
}

// Each type: display label, one-line tagline, and the medallion gradient.
export const PERSONALITY_TYPES = {
  'true-freshman': {
    label: 'True Freshman',
    tagline: 'The rare all-rounder who refuses to fit a single mold.',
    grad: ['#f5c542', '#d4951f'],
  },
  engineer: {
    label: 'Engineer',
    tagline: 'You build things with your hands and solve problems by making them real.',
    grad: ['#ff9a3c', '#d4630f'],
  },
  programming: {
    label: 'Programmer',
    tagline: 'You think in systems and logic — software is your medium.',
    grad: ['#2dd4a7', '#0e7c66'],
  },
  scientist: {
    label: 'Scientist',
    tagline: 'Driven by curiosity, you live for discovery and the lab.',
    grad: ['#6c8cff', '#3a4fc4'],
  },
  environmentalist: {
    label: 'Environmentalist',
    tagline: 'You want your work to heal the planet and its communities.',
    grad: ['#5bc47a', '#2e7d4f'],
  },
  business: {
    label: 'Business Mind',
    tagline: 'A natural strategist wired for leadership, markets, and impact.',
    grad: ['#3a5da8', '#c9a227'],
  },
  'social-scientist': {
    label: 'Social Scientist',
    tagline: 'You decode how people, societies, and institutions really work.',
    grad: ['#f0a93f', '#b8553f'],
  },
  humanitarian: {
    label: 'Humanitarian',
    tagline: 'Big questions of meaning, ethics, and justice drive you.',
    grad: ['#a06cd4', '#5e3a8c'],
  },
  artistic: {
    label: 'Artist',
    tagline: 'You see the world through craft, expression, and beauty.',
    grad: ['#ff6fa5', '#ff9a3c'],
  },
}

export default function PersonalityBadge({ type }) {
  const data = PERSONALITY_TYPES[type]
  if (!data) return null

  const [c1, c2] = data.grad
  const icon = ICONS[type] || ICONS.scientist

  return (
    <motion.div
      className="personality-badge"
      initial={{ opacity: 0, y: 18, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 220, damping: 22, delay: 0.1 }}
    >
      <div
        className="pb-medallion"
        style={{ '--pb-c1': c1, '--pb-c2': c2 }}
      >
        <span className="pb-medallion__ring" />
        <span className="pb-medallion__icon">{icon}</span>
      </div>
      <div className="pb-eyebrow">Your Freshman type</div>
      <div className="pb-label">{data.label}</div>
      <p className="pb-tagline">{data.tagline}</p>
    </motion.div>
  )
}
