import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const PHRASES = [
  "lowkey asking our AI bestie rn 🔮",
  "running the numbers, no cap 📊",
  "main character arc loading... 📚",
  "the algorithm is cooking fr 💅",
  "scanning 143+ schools for your vibe ✨",
  "slay, the good things take a sec 💀",
  "manifesting your acceptance letters 🪄",
  "real ones wait for the W schools 🎯",
  "reading your aura against each campus 🧠",
  "blocking every financial L rn 💰",
  "bestie we're about to change your life 🎓",
  "doing math harder than your SAT rn 😭",
]

function LoadingBar() {
  const [progress, setProgress]   = useState(0)
  const [eta, setEta]             = useState(22)
  const [phraseIdx, setPhraseIdx] = useState(0)

  useEffect(() => {
    const progId   = setInterval(() => setProgress(p => p + (88 - p) * 0.07), 380)
    const etaId    = setInterval(() => setEta(e => Math.max(0, e - 1)), 1000)
    const phraseId = setInterval(() => setPhraseIdx(i => (i + 1) % PHRASES.length), 2800)
    return () => { clearInterval(progId); clearInterval(etaId); clearInterval(phraseId) }
  }, [])

  return (
    <div className="results-loading">
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={phraseIdx}
          className="results-phrase"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.26 }}
        >
          {PHRASES[phraseIdx]}
        </motion.p>
      </AnimatePresence>
      <div className="results-bar-wrap">
        <div className="results-bar" style={{ width: `${progress}%` }} />
      </div>
      <p className="results-eta">{eta > 0 ? `~${eta}s` : 'almost there…'}</p>
    </div>
  )
}
import '../styles/Results.css'
import { useQuiz } from '../context/QuizContext'
import { schoolBadge } from '../data/schoolLogos'

const MAX_SCHOOLS = 14

const PROGRAMS = {
  'full-support': {
    label: 'Full Support',
    tagline: "Freshman Academy's flagship — the Central Asian leader in Ivy League admissions.",
    desc: "12–15 competitive students work one-on-one with mentors to craft an Ivy-level university application. Over 85% of students are admitted to a competitive U.S. or global college, including Harvard, Yale, Stanford, and more.",
    bullets: [
      '12–15 students selected annually from 95+ applications',
      'Personal statement, supplements, research paper & CommonApp',
      '85%+ admitted to top US and global universities',
    ],
    url: 'https://freshman.academy/full-support',
    cta: 'Reserve Your Spot',
  },
  admissions: {
    label: 'Admissions Program',
    tagline: "Freshman Academy's most life-changing program yet.",
    desc: "Students write 25,000+ words of essays and engage with hundreds of pages of undergraduate literature — experiencing Ivy League education before you even enroll.",
    bullets: [
      '24 live lessons + 19+ hours of 1-on-1 mentorship',
      'Personal statement, research paper & full essay coaching',
      'Curriculum reviewed by a Virginia Tech professor & 15-year admissions expert',
    ],
    url: 'https://freshman.academy/admissions',
    cta: 'Reserve Your Spot',
  },
}

function getRecommendation(testScores, honors, extracurriculars) {
  const sat = parseInt(testScores?.sat) || 0
  const topHonors = (honors || []).filter(h => h.level === 'intl' || h.level === 'natl').length
  const filledEcs = (extracurriculars || []).filter(e => e.description?.trim()).length
  if (sat >= 1500 && (topHonors >= 1 || filledEcs >= 5)) return 'full-support'
  if (topHonors >= 2 && filledEcs >= 5) return 'full-support'
  return 'admissions'
}

function LogoBadge({ id, name, size }) {
  const { path, monogram } = schoolBadge(id, name)
  const [imgErr, setImgErr] = useState(false)

  if (path && !imgErr) {
    return (
      <div className={`sc-logo sc-logo--img sc-logo--${size}`}>
        <img src={path} alt={name} onError={() => setImgErr(true)} />
      </div>
    )
  }
  return (
    <div className={`sc-logo sc-logo--mono sc-logo--${size}`}>
      {monogram}
    </div>
  )
}

function SchoolTile({ school, index, onExpand, invisible }) {
  const [mouse, setMouse] = useState({ x: 0, y: 0 })
  const [hovered, setHovered] = useState(false)

  const handleMove = useCallback((e) => {
    const r = e.currentTarget.getBoundingClientRect()
    setMouse({ x: (e.clientX - r.left) / r.width - 0.5, y: (e.clientY - r.top) / r.height - 0.5 })
  }, [])

  const handleLeave = useCallback(() => {
    setHovered(false)
    setMouse({ x: 0, y: 0 })
  }, [])

  return (
    <motion.div
      className={`school-tile${index < 3 ? ' school-tile--top' : ''}`}
      style={{
        opacity: invisible ? 0 : 1,
        pointerEvents: invisible ? 'none' : 'auto',
        transformStyle: 'preserve-3d',
        transformPerspective: 800,
      }}
      onMouseMove={handleMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={handleLeave}
      onClick={() => onExpand(index)}
      animate={{
        rotateX: hovered ? mouse.y * -24 : 0,
        rotateY: hovered ? mouse.x * 24 : 0,
        z: hovered ? 18 : 0,
        scale: hovered ? 1.04 : 1,
      }}
      transition={{ type: 'spring', stiffness: 360, damping: 26 }}
      whileTap={{ scale: 0.96 }}
    >
      <div className="school-tile__score">{school.fitScore}</div>
      <LogoBadge id={school.id} name={school.name} size="tile" />
      <div className="school-tile__name">{school.name}</div>
      {/* Radial shine following cursor */}
      <motion.div
        className="school-tile__shine"
        style={{
          background: `radial-gradient(circle at ${(mouse.x + 0.5) * 100}% ${(mouse.y + 0.5) * 100}%, rgba(241, 141, 5, 0.28) 0%, transparent 18%)`,
        }}
        animate={{ opacity: hovered ? 1 : 0 }}
        transition={{ duration: 0.12 }}
      />
    </motion.div>
  )
}

function ExpandedSchool({ school, index, total, onClose, onNav, navDirRef }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') onNav(-1)
      if (e.key === 'ArrowRight') onNav(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onNav])

  const dir = navDirRef.current

  return (
    <>
      <motion.div
        className="school-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22 }}
        onClick={onClose}
      />
      <div className="school-modal-wrap">
        <motion.div
          className="school-expanded"
          initial={{ opacity: 0, scale: 0.90, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.90, y: 24 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          onClick={e => e.stopPropagation()}
        >
          <button className="school-expanded__close" onClick={onClose} aria-label="Close">✕</button>

          <div className="school-expanded__scroll">
            <AnimatePresence initial={false} mode="wait">
              <motion.div
                key={school.id}
                className="school-expanded__inner"
                initial={{ opacity: 0, x: dir * 52 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -dir * 52 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="school-expanded__header">
                  <LogoBadge id={school.id} name={school.name} size="expanded" />
                  <div className="school-expanded__info">
                    <div className="school-expanded__name">{school.name}</div>
                    <div className="school-expanded__score-row">
                      <span className="school-expanded__score">{school.fitScore}</span>
                      <span className="school-expanded__score-label">fit score</span>
                    </div>
                  </div>
                </div>

                <p className="school-expanded__narrative">{school.narrative}</p>

                {(school.matchReasons?.length > 0 || school.concerns?.length > 0) && (
                  <div className="school-expanded__reasons">
                    {school.matchReasons?.map((r, j) => (
                      <div key={j} className="reason-match">✓ {r}</div>
                    ))}
                    {school.matchReasons?.length > 0 && school.concerns?.length > 0 && (
                      <div className="reason-sep" />
                    )}
                    {school.concerns?.map((c, j) => (
                      <div key={j} className="reason-concern">○ {c}</div>
                    ))}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="school-expanded__nav">
            <button
              className="nav-arrow"
              onClick={() => onNav(-1)}
              disabled={index <= 0}
              aria-label="Previous"
            >‹</button>
            <span className="school-expanded__counter">{index + 1} / {total}</span>
            <button
              className="nav-arrow"
              onClick={() => onNav(1)}
              disabled={index >= total - 1}
              aria-label="Next"
            >›</button>
          </div>
        </motion.div>
      </div>
    </>
  )
}

function CtaSection({ rec }) {
  const prog = PROGRAMS[rec]
  const isFS = rec === 'full-support'

  return (
    <motion.section
      className={`results-cta${isFS ? ' results-cta--fs' : ''}`}
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px' }}
      transition={{ type: 'spring', stiffness: 190, damping: 26 }}
    >
      <div className="cta-top-row">
        <div>
          <div className="cta-eyebrow">Recommended for you</div>
          <div className="cta-name">{prog.label}</div>
        </div>
        <a
          href={prog.url}
          target="_blank"
          rel="noopener noreferrer"
          className="cta-btn"
        >
          <span className="cta-btn__spark" />
          <span className="cta-btn__backdrop" />
          <span className="cta-btn__label">{prog.cta} →</span>
        </a>
      </div>
      <p className="cta-desc">{prog.desc}</p>
      <div className="cta-bullets">
        {prog.bullets.map((b, i) => (
          <div key={i} className="cta-bullet">
            <span className="cta-bullet-check">✓</span>
            <span>{b}</span>
          </div>
        ))}
      </div>
    </motion.section>
  )
}

export default function Results() {
  const { state, dispatch } = useQuiz()
  const { name, testScores, extracurriculars, honors, essay, efc } = state

  const [status, setStatus]     = useState('loading')
  const [schools, setSchools]   = useState([])
  const [errorMsg, setErrorMsg] = useState('')
  const [expandedIndex, setExpandedIndex] = useState(null)
  const navDirRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    async function fetchResults() {
      try {
        const res = await fetch('/api/narrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, testScores, extracurriculars, honors, essay, efc }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || `Server error ${res.status}`)
        if (!cancelled) {
          setSchools((data.schools || []).slice(0, MAX_SCHOOLS))
          setStatus('done')
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err.message)
          setStatus('error')
        }
      }
    }
    fetchResults()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleExpand = useCallback((index) => {
    navDirRef.current = 0
    setExpandedIndex(index)
  }, [])

  const handleNav = useCallback((direction) => {
    navDirRef.current = direction
    setExpandedIndex(prev => {
      const next = prev + direction
      return next < 0 || next >= schools.length ? prev : next
    })
  }, [schools.length])

  const handleClose = useCallback(() => {
    navDirRef.current = 0
    setExpandedIndex(null)
  }, [])

  const rec = getRecommendation(testScores, honors, extracurriculars)

  const cols = schools.length <= 4
    ? (schools.length || 1)
    : Math.min(7, Math.ceil(schools.length / 2))

  return (
    <>
      <div className="results-page">
        {/* ── Above-fold: fills at least full viewport so CTA always requires scrolling ── */}
        <div className="results-above-fold">
          <div className="results-header">
            <div className="results-complete res-rise" style={{ animationDelay: '0ms' }}>
              <span className="results-check">✓</span> Assessment complete
            </div>

            {status === 'loading' && (
              <div className="res-rise" style={{ animationDelay: '60ms' }}>
                <LoadingBar />
              </div>
            )}

            {status === 'error' && (
              <>
                <div className="results-eyebrow res-rise" style={{ animationDelay: '60ms' }}>Error</div>
                <div className="results-title res-rise" style={{ animationDelay: '110ms' }}>Something went wrong</div>
                <p className="results-desc res-rise" style={{ animationDelay: '170ms' }}>{errorMsg}</p>
              </>
            )}

            {status === 'done' && (
              <>
                <div className="results-eyebrow res-rise" style={{ animationDelay: '60ms' }}>College Matches</div>
                <div className="results-title res-rise" style={{ animationDelay: '110ms' }}>
                  {schools.length > 0
                    ? `${schools.length} schools for ${name || 'you'}`
                    : 'No financial matches found'}
                </div>
                <p className="results-subtitle res-rise" style={{ animationDelay: '150ms' }}>
                  {schools.length > 0
                    ? 'Tap any school to see your full fit analysis.'
                    : 'No schools met both your academic and financial requirements. Contact Freshman Academy for personalized guidance.'}
                </p>
              </>
            )}
          </div>

          {status === 'done' && schools.length > 0 && (
            <motion.div
              className="school-grid"
              style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.05, delayChildren: 0.18 } },
              }}
            >
              {schools.map((school, i) => (
                <motion.div
                  key={school.id}
                  variants={{
                    hidden: { opacity: 0, y: 20, scale: 0.94 },
                    visible: {
                      opacity: 1, y: 0, scale: 1,
                      transition: { type: 'spring', stiffness: 260, damping: 22 },
                    },
                  }}
                >
                  <SchoolTile
                    school={school}
                    index={i}
                    onExpand={handleExpand}
                    invisible={expandedIndex === i}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}

          {status === 'done' && schools.length > 0 && (
            <div className="results-scroll-nudge">
              <span>Your next step</span>
              <span className="nudge-arrow">↓</span>
            </div>
          )}
        </div>

        {/* ── CTA: always below the fold ── */}
        {status === 'done' && schools.length > 0 && <CtaSection rec={rec} />}

        <div className="results-divider res-rise" style={{ animationDelay: '200ms' }} />
        <div className="results-actions res-rise" style={{ animationDelay: '240ms' }}>
          <button className="restart-btn" onClick={() => dispatch({ type: 'RESTART' })}>
            ↺ Start Over
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expandedIndex !== null && schools[expandedIndex] && (
          <ExpandedSchool
            key="expanded"
            school={schools[expandedIndex]}
            index={expandedIndex}
            total={schools.length}
            onClose={handleClose}
            onNav={handleNav}
            navDirRef={navDirRef}
          />
        )}
      </AnimatePresence>
    </>
  )
}
