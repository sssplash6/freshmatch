import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const PHRASES = [
  "digging through admissions lore 📚",
  "checking if your extracurriculars are built different 🚀",
  "doing math harder than your SAT rn 😭",
]

const ETA_TOTAL = 25

function LoadingBar() {
  const [eta, setEta]             = useState(ETA_TOTAL)
  const [phraseIdx, setPhraseIdx] = useState(0)
  const barRef   = useRef(null)
  const startRef = useRef(null)

  useEffect(() => {
    startRef.current = performance.now()
    let rafId

    function tick(now) {
      const elapsed = (now - startRef.current) / 1000
      const t = Math.min(elapsed / ETA_TOTAL, 1)
      if (barRef.current) barRef.current.style.width = `${t * 88}%`
      setEta(Math.max(0, Math.round(ETA_TOTAL - elapsed)))
      if (t < 1) rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    const phraseId = setInterval(() => setPhraseIdx(i => (i + 1) % PHRASES.length), 2800)
    return () => { cancelAnimationFrame(rafId); clearInterval(phraseId) }
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
        <div className="results-bar" ref={barRef} />
      </div>
      <p className="results-eta">{eta > 0 ? `~${eta}s` : 'almost there…'}</p>
    </div>
  )
}
import '../styles/Results.css'
import { useQuiz } from '../context/QuizContext'
import { schoolBadge } from '../data/schoolLogos'

const MAX_SCHOOLS = 12

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
    </motion.div>
  )
}

function ExpandedSchool({ school, index, total, isDream, onClose, onNav, navDirRef }) {
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
                      {isDream && school.chance != null && (
                        <>
                          <span className="school-expanded__score school-expanded__score--chance">{school.chance}</span>
                          <span className="school-expanded__score-label">admission chance</span>
                        </>
                      )}
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
                      <div key={j} className="reason-concern">? {c}</div>
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

// Glow follows FIT (same bands as regular tiles): ≥85 green, 75–84 orange, <75 red
function dreamGlowClass(fitScore) {
  if (fitScore >= 85) return 'dream-tile-wrap--green'
  if (fitScore >= 75) return 'dream-tile-wrap--orange'
  return 'dream-tile-wrap--red'
}

function DreamSchoolTile({ school, onExpand, index, invisible }) {
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
    <div
      className={`dream-tile-wrap ${dreamGlowClass(school.fitScore)}`}
      style={{ opacity: invisible ? 0 : 1, pointerEvents: invisible ? 'none' : 'auto' }}
    >
      <motion.div
        className="dream-tile"
        style={{ transformStyle: 'preserve-3d', transformPerspective: 800 }}
        onMouseMove={handleMove}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={handleLeave}
        onClick={() => onExpand(index)}
        animate={{
          rotateX: hovered ? mouse.y * -20 : 0,
          rotateY: hovered ? mouse.x * 20 : 0,
        }}
        transition={{ type: 'spring', stiffness: 360, damping: 26 }}
        whileTap={{ scale: 0.97 }}
      >
        <div className="dream-tile__fit">
          {school.fitScore}
          <span className="dream-tile__score-label">fit</span>
        </div>
        <div className="dream-tile__score">
          {school.chance ?? school.fitScore}
          <span className="dream-tile__score-label">chance</span>
        </div>
        <LogoBadge id={school.id} name={school.name} size="tile" />
        <div className="dream-tile__name">{school.name}</div>
      </motion.div>
    </div>
  )
}

export default function Results() {
  const { state, dispatch } = useQuiz()
  const { name, email, country, schoolName, grade, section1Answers, testScores, extracurriculars, honors, essay, personalityAnswers, majors, dreamSchools, efc, consentData, consentOffers } = state

  const [status, setStatus]         = useState('loading')
  const [schools, setSchools]       = useState([])
  const [dreamResults, setDreamResults] = useState([])
  const [errorMsg, setErrorMsg]     = useState('')
  const [expandedIndex, setExpandedIndex] = useState(null)
  const [expandedPool, setExpandedPool]   = useState('regular') // 'regular' | 'dream'
  const navDirRef = useRef(0)

  // Unified pool for expanded modal navigation (dream first, then regular)
  const allSchools = [...dreamResults, ...schools]

  useEffect(() => {
    let cancelled = false
    async function fetchResults() {
      try {
        const res = await fetch('/api/narrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // Send the complete quiz state so the full submission can be stored.
          // email/schoolName/section1Answers aren't used for matching, but are
          // captured for the saved record.
          body: JSON.stringify({ name, email, country, schoolName, grade, section1Answers, testScores, extracurriculars, honors, essay, personality: personalityAnswers, majors, dreamSchools, efc, consentData, consentOffers }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || `Server error ${res.status}`)
        if (!cancelled) {
          setDreamResults((data.dreamSchools || []).slice(0, 3))
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
      return next < 0 || next >= allSchools.length ? prev : next
    })
  }, [allSchools.length])

  const handleClose = useCallback(() => {
    navDirRef.current = 0
    setExpandedIndex(null)
  }, [])

  const rec = getRecommendation(testScores, honors, extracurriculars)

  const regularCols = schools.length <= 4
    ? (schools.length || 1)
    : Math.min(6, Math.ceil(schools.length / 2))

  const totalCount = dreamResults.length + schools.length

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
                  {totalCount > 0
                    ? `${totalCount} schools for ${name || 'you'}`
                    : 'No financial matches found'}
                </div>
                <p className="results-subtitle res-rise" style={{ animationDelay: '150ms' }}>
                  {totalCount > 0
                    ? 'Tap any school to see your full fit analysis.'
                    : 'No schools met both your academic and financial requirements. Contact Freshman Academy for personalized guidance.'}
                </p>
              </>
            )}
          </div>

          {status === 'done' && totalCount > 0 && (
            <div className="click-nudge" aria-hidden="true">
              <span className="click-nudge__text">psst… tap a card!</span>
              <svg className="click-nudge__arrow" viewBox="0 0 64 54" fill="none">
                <path d="M5 7 C 15 36, 36 30, 50 45" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
                <path d="M39 43 L51 47 L45 35" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}

          {/* ── Dream schools row ─── */}
          {status === 'done' && dreamResults.length > 0 && (
            <motion.div
              className="dream-schools-section"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.06, delayChildren: 0.12 } },
              }}
            >
              <div className="dream-schools-eyebrow">Your dream schools</div>
              <div className="dream-schools-grid">
                {dreamResults.map((school, i) => (
                  <motion.div
                    key={school.id}
                    variants={{
                      hidden: { opacity: 0, y: 22, scale: 0.93 },
                      visible: {
                        opacity: 1, y: 0, scale: 1,
                        transition: { type: 'spring', stiffness: 240, damping: 22 },
                      },
                    }}
                  >
                    <DreamSchoolTile
                      school={school}
                      index={i}
                      onExpand={handleExpand}
                      invisible={expandedIndex === i}
                    />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Regular matches grid ─── */}
          {status === 'done' && schools.length > 0 && (
            <motion.div
              className="school-grid"
              style={{ gridTemplateColumns: `repeat(${regularCols}, 1fr)` }}
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.04, delayChildren: dreamResults.length > 0 ? 0.32 : 0.18 } },
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
                    onExpand={(idx) => handleExpand(idx + dreamResults.length)}
                    invisible={expandedIndex === i + dreamResults.length}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}

          {status === 'done' && totalCount > 0 && (
            <div className="results-scroll-nudge">
              <span>Your next step</span>
              <span className="nudge-arrow">↓</span>
            </div>
          )}
        </div>

        {/* ── CTA: always below the fold ── */}
        {status === 'done' && totalCount > 0 && <CtaSection rec={rec} />}

        <div className="results-divider res-rise" style={{ animationDelay: '200ms' }} />
        <div className="results-actions res-rise" style={{ animationDelay: '240ms' }}>
          <button className="restart-btn" onClick={() => dispatch({ type: 'RESTART' })}>
            ↺ Start Over
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expandedIndex !== null && allSchools[expandedIndex] && (
          <ExpandedSchool
            key="expanded"
            school={allSchools[expandedIndex]}
            index={expandedIndex}
            total={allSchools.length}
            isDream={expandedIndex < dreamResults.length}
            onClose={handleClose}
            onNav={handleNav}
            navDirRef={navDirRef}
          />
        )}
      </AnimatePresence>
    </>
  )
}
