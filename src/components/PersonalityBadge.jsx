import { useState } from 'react'
import { motion } from 'framer-motion'
import '../styles/PersonalityBadge.css'

// Each type: display label and one-line tagline.
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
  const [imgErr, setImgErr] = useState(false)
  if (!data) return null

  // Per-type emblem lives at public/personality/<type>.png. Until that file
  // exists the image errors out and we hide it, leaving the text-only badge.
  const logo = `${import.meta.env.BASE_URL}personality/${type}.png`

  return (
    <motion.div
      className="personality-badge"
      initial={{ opacity: 0, y: 18, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 220, damping: 22, delay: 0.1 }}
    >
      {!imgErr && (
        <div
          className="pb-emblem"
          style={{ '--pb-grad-a': data.grad[0], '--pb-grad-b': data.grad[1] }}
        >
          <img src={logo} alt={data.label} onError={() => setImgErr(true)} />
        </div>
      )}
      <div className="pb-eyebrow">Your Freshman type</div>
      <div className="pb-label">{data.label}</div>
      <p className="pb-tagline">{data.tagline}</p>
    </motion.div>
  )
}
