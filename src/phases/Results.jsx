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
import PersonalityBadge from '../components/PersonalityBadge'

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

// Per-college PDF report — live quiz only (shared /r/:token pages have no
// profile to generate from, so `onGenerateReport` arrives null there and the
// block never renders). Generation takes a real ~20–45s: the status line keeps
// the modal honest about it, and a finished report becomes a plain link so
// popup blockers never eat the PDF.
function ReportCta({ school, report, onGenerateReport }) {
  if (!onGenerateReport) return null
  return (
    <div className="report-cta">
      {!report && (
        <>
          <button className="report-btn" onClick={() => onGenerateReport(school)}>
            Get the full report (PDF)
          </button>
          <p className="report-hint">
            Where you stand vs admitted students, what to do about it, and how each move changes your modeled chance.
          </p>
        </>
      )}
      {report?.status === 'loading' && (
        <p className="report-status">Building your {school.name} report — usually 20–45 seconds…</p>
      )}
      {report?.status === 'ready' && (
        <a className="report-btn report-btn--ready" href={report.url} target="_blank" rel="noopener noreferrer">
          ↗ Open your report (PDF)
        </a>
      )}
      {report?.status === 'error' && (
        <>
          <p className="report-error">{report.error}</p>
          <button className="report-btn" onClick={() => onGenerateReport(school)}>Try again</button>
        </>
      )}
    </div>
  )
}

function ExpandedSchool({ school, index, total, isDream, onClose, onNav, navDirRef, reportState, onGenerateReport }) {
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
                          <span className="school-expanded__score-label">strength</span>
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

                <ReportCta
                  school={school}
                  report={reportState?.[school.id]}
                  onGenerateReport={onGenerateReport}
                />
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
          <span className="dream-tile__score-label">strength</span>
        </div>
        <LogoBadge id={school.id} name={school.name} size="tile" />
        <div className="dream-tile__name">{school.name}</div>
      </motion.div>
    </div>
  )
}

// Share button — native share sheet where available (mostly mobile), with a
// copy-to-clipboard fallback for everything else. Robust by design: native share
// failing for any reason other than a deliberate user cancel falls through to
// copy, and copy itself has a legacy execCommand fallback, so a click always
// does something visible.
function ShareButton({ token }) {
  const [copied, setCopied] = useState(false)
  const url = `${window.location.origin}/r/${token}`

  function flagCopied() {
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
      flagCopied()
      return
    } catch { /* clipboard API blocked / non-secure context — fall back */ }
    try {
      const ta = document.createElement('textarea')
      ta.value = url
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      flagCopied()
    } catch {
      window.prompt('Copy your results link:', url)
    }
  }

  async function onShare() {
    // Native share is reliable only on touch/mobile. On desktop navigator.share
    // often exists but rejects with AbortError WITHOUT ever showing a sheet (or
    // resolves silently) — the old code then returned and the click did nothing.
    // So gate native share to coarse-pointer devices; desktop always copies,
    // which is dependable and always gives visible feedback.
    const canNativeShare =
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      typeof window !== 'undefined' &&
      window.matchMedia?.('(pointer: coarse)')?.matches
    if (canNativeShare) {
      try {
        await navigator.share({ title: 'My FreshMatch college matches', text: 'I just got my college matches — find yours in 5 min 👇', url })
        return
      } catch (e) {
        if (e?.name === 'AbortError') return  // user dismissed the sheet — don't also copy
        // any other failure (unsupported, not allowed) → fall through to copy
      }
    }
    copyLink()
  }

  return (
    <button className="share-btn share-btn--inline" onClick={onShare}>
      {copied ? '✓ Link copied' : '🔗 Share'}
    </button>
  )
}

// Max school-grid columns that stay legible at a given viewport width. The grid
// column count is an inline style (so it can't be overridden by a CSS media
// query), hence the responsive cap lives here instead of in CSS — otherwise a
// 12-school result forces 6 columns onto a phone and the tiles collapse.
function maxColsForViewport() {
  const w = typeof window !== 'undefined' ? window.innerWidth : 1280
  if (w <= 400) return 2
  if (w <= 560) return 3
  if (w <= 760) return 4
  return 6
}

// Presentational results screen — pure, driven entirely by props so it renders
// identically for the live quiz and for a read-only shared link (/r/:token).
// `actions` is the slot under the results for the buttons that differ by context
// (Share + Start Over when live; "Take the quiz yourself" on a shared view).
export function ResultsView({ name, personalityType, schools = [], dreamResults = [], recommendation, actions, titleAction, reportState, onGenerateReport }) {
  const [expandedIndex, setExpandedIndex] = useState(null)
  const [maxCols, setMaxCols] = useState(maxColsForViewport)
  const navDirRef = useRef(0)

  // Re-clamp the grid columns when the viewport changes (resize / orientation).
  useEffect(() => {
    const onResize = () => setMaxCols(maxColsForViewport())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Unified pool for expanded modal navigation (dream first, then regular)
  const allSchools = [...dreamResults, ...schools]

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

  const desiredCols = schools.length <= 4
    ? (schools.length || 1)
    : Math.min(6, Math.ceil(schools.length / 2))
  const regularCols = Math.min(desiredCols, maxCols)

  const totalCount = dreamResults.length + schools.length

  return (
    <>
      <div className="results-page">
        {/* ── Above-fold: fills at least full viewport so CTA always requires scrolling ── */}
        <div className="results-above-fold">
          <div className="results-header">
            <img className="results-brand" src={`${import.meta.env.BASE_URL}brand-shield.png`} alt="Freshman Academy" />
            <div className="results-complete res-rise" style={{ animationDelay: '0ms' }}>
              <span className="results-check">✓</span> Assessment complete
            </div>

            {personalityType && <PersonalityBadge type={personalityType} />}
            <div className="results-eyebrow res-rise" style={{ animationDelay: '60ms' }}>College Matches</div>
            <div className="results-title-row res-rise" style={{ animationDelay: '110ms' }}>
              <h1 className="results-title">
                {totalCount > 0
                  ? `${totalCount} schools for ${name || 'you'}`
                  : 'No financial matches found'}
              </h1>
              {totalCount > 0 && titleAction}
            </div>
            {totalCount === 0 && (
              <p className="results-subtitle res-rise" style={{ animationDelay: '150ms' }}>
                No schools met both your academic and financial requirements. Contact Freshman Academy for personalized guidance.
              </p>
            )}
          </div>

          {totalCount > 0 && (
            <div className="click-nudge" aria-hidden="true">
              <span className="click-nudge__text">psst… tap a card!</span>
            </div>
          )}

          {/* ── Dream schools row ─── */}
          {dreamResults.length > 0 && (
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
          {schools.length > 0 && (
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

          {totalCount > 0 && (
            <div className="results-scroll-nudge">
              <span>Your next step</span>
              <span className="nudge-arrow">↓</span>
            </div>
          )}
        </div>

        {/* ── CTA: always below the fold ── */}
        {totalCount > 0 && <CtaSection rec={recommendation} />}

        <div className="results-divider res-rise" style={{ animationDelay: '200ms' }} />
        <div className="results-actions res-rise" style={{ animationDelay: '240ms' }}>
          {actions}
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
            reportState={reportState}
            onGenerateReport={onGenerateReport}
          />
        )}
      </AnimatePresence>
    </>
  )
}

export default function Results() {
  const { state, dispatch } = useQuiz()
  const { name, email, country, schoolName, grade, section1Answers, testScores, extracurriculars, honors, essay, personalityAnswers, majors, dreamSchools, efc, consentData, consentOffers, verifyToken } = state

  const [status, setStatus]         = useState('loading')
  const [schools, setSchools]       = useState([])
  const [dreamResults, setDreamResults] = useState([])
  const [personalityType, setPersonalityType] = useState(null)
  const [recommendation, setRecommendation] = useState(null)
  const [shareToken, setShareToken] = useState(null)
  const [errorMsg, setErrorMsg]     = useState('')
  const [reports, setReports]       = useState({})  // collegeId → { status, url?, error? }

  // Per-college PDF report. The server is idempotent on (profile, college,
  // engine version) — a re-click after success or a repeat for the same school
  // is a ~3ms cache hit, so no client-side guard beyond the loading state.
  const generateReport = useCallback(async (school) => {
    const id = school.id
    setReports(r => ({ ...r, [id]: { status: 'loading' } }))
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, email, country, grade, testScores, extracurriculars, honors, essay, majors, efc,
          consentData, verifyToken,
          collegeId: id,
          fitScore: school.fitScore,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Server error ${res.status}`)
      setReports(r => ({ ...r, [id]: { status: 'ready', url: data.pdfUrl } }))
    } catch (err) {
      setReports(r => ({ ...r, [id]: { status: 'error', error: err.message } }))
    }
  }, [name, email, country, grade, testScores, extracurriculars, honors, essay, majors, efc, consentData, verifyToken])

  useEffect(() => {
    let cancelled = false
    async function fetchResults() {
      if (window.location.search.includes('sample')) {
        const n = (id, name, fitScore, chance) => ({ id, name, fitScore, chance, narrative: `${name} is a strong match for this profile — the academics, intended major, and activities line up well with what the school looks for.`, matchReasons: [], concerns: [] })
        setDreamResults([n('cornell','Cornell University',82,70), n('nyuad','NYU Abu Dhabi',91,64), n('stanford','Stanford University',79,64)])
        setSchools([n('gu-q','Georgetown University Qatar',95), n('princeton','Princeton University',90), n('upenn','University of Pennsylvania',89), n('williams','Williams College',87), n('amherst','Amherst College',85), n('claremont-mckenna','Claremont McKenna College',84), n('tufts','Tufts University',82), n('middlebury','Middlebury College',78), n('hamilton','Hamilton College',76), n('colby','Colby College',74), n('macalester','Macalester College',72)])
        setPersonalityType('business')
        setRecommendation('full-support')
        setShareToken('sample')  // so the Share button renders in ?sample preview
        setStatus('done')
        return
      }
      try {
        const res = await fetch('/api/narrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // Send the complete quiz state so the full submission can be stored.
          // email/schoolName/section1Answers aren't used for matching, but are
          // captured for the saved record.
          body: JSON.stringify({ name, email, country, schoolName, grade, section1Answers, testScores, extracurriculars, honors, essay, personality: personalityAnswers, majors, dreamSchools, efc, consentData, consentOffers, verifyToken }),
        })
        const data = await res.json()
        // Verification token missing/expired — bounce back to the verify step
        // so the student can re-request a code, rather than show a dead error.
        if (res.status === 401 && data.needVerification) {
          if (!cancelled) dispatch({ type: 'NEED_VERIFY' })
          return
        }
        // The profile was judged gibberish / too sparse to assess — show a
        // dedicated "not enough info" screen instead of a generic error.
        if (res.status === 422 && data.insufficient) {
          if (!cancelled) {
            setErrorMsg(data.error || "We couldn't find enough real information to generate an assessment.")
            setStatus('insufficient')
          }
          return
        }
        if (!res.ok) throw new Error(data.error || `Server error ${res.status}`)
        if (!cancelled) {
          setDreamResults((data.dreamSchools || []).slice(0, 3))
          setSchools((data.schools || []).slice(0, MAX_SCHOOLS))
          setPersonalityType(data.personalityType || null)
          setRecommendation(data.recommendation || null)
          setShareToken(data.shareToken || null)
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

  // Quiz progress lives in in-memory state, so a refresh would silently drop
  // the student back to the landing page. Warn before unload — the browser
  // shows its native "Reload site? / Leave site?" confirmation.
  useEffect(() => {
    function onBeforeUnload(e) {
      e.preventDefault()
      e.returnValue = '' // required for Chrome to show the prompt
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  // The done state renders through the shared, presentational ResultsView so the
  // live quiz and a shared /r/:token link look identical. Live-only actions:
  // share the results (once we have a token) and start over.
  if (status === 'done') {
    return (
      <ResultsView
        name={name}
        personalityType={personalityType}
        schools={schools}
        dreamResults={dreamResults}
        recommendation={recommendation || getRecommendation(testScores, honors, extracurriculars)}
        titleAction={shareToken && <ShareButton token={shareToken} />}
        reportState={reports}
        onGenerateReport={generateReport}
        actions={
          <button className="restart-btn" onClick={() => dispatch({ type: 'RESTART' })}>
            ↺ Start Over
          </button>
        }
      />
    )
  }

  // Loading / error / insufficient — the pre-results states, owned by the live flow.
  return (
    <div className="results-page">
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

          {status === 'insufficient' && (
            <>
              <div className="results-eyebrow res-rise" style={{ animationDelay: '60ms' }}>Not enough information</div>
              <div className="results-title res-rise" style={{ animationDelay: '110ms' }}>We can't assess this profile yet</div>
              <p className="results-desc res-rise" style={{ animationDelay: '170ms' }}>{errorMsg}</p>
              <button
                className="results-edit-btn res-rise"
                style={{ animationDelay: '230ms' }}
                onClick={() => dispatch({ type: 'EDIT' })}
              >
                ← Go back and edit my answers
              </button>
            </>
          )}
        </div>
      </div>

      <div className="results-divider res-rise" style={{ animationDelay: '200ms' }} />
      <div className="results-actions res-rise" style={{ animationDelay: '240ms' }}>
        <button className="restart-btn" onClick={() => dispatch({ type: 'RESTART' })}>
          ↺ Start Over
        </button>
      </div>
    </div>
  )
}
