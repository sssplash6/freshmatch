import { useEffect, useRef, useState } from 'react'
import { isValidHonorTitle, MIN_HONOR_CHARS } from '../utils/validation'
import '../styles/HonorsInput.css'

const MAX = 5

const LEVELS = [
  { value: 'intl',     label: 'International' },
  { value: 'natl',     label: 'National' },
  { value: 'regional', label: 'Regional' },
  { value: 'school',   label: 'School' },
]

function HonorLevelDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const current = LEVELS.find(l => l.value === value)

  return (
    <div className="honor-level-wrap" ref={wrapRef}>
      <button
        type="button"
        className="honor-level-btn"
        onClick={() => setOpen(o => !o)}
      >
        {current ? current.label : 'Level'} <span className="honor-level-caret">▾</span>
      </button>
      {open && (
        <div className="honor-level-menu">
          {LEVELS.map(l => (
            <button
              key={l.value}
              type="button"
              className={`honor-level-opt${value === l.value ? ' honor-level-opt--on' : ''}`}
              onMouseDown={() => { onChange(l.value); setOpen(false) }}
            >{l.label}</button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function HonorsInput({
  honors,
  onAdd,
  onUpdate,
  onRemove,
  onNext,
  onBack,
  direction,
  sectionLabel,
  counter,
}) {
  const lastRef = useRef(null)
  const prevLengthRef = useRef(honors.length)

  useEffect(() => {
    if (honors.length > prevLengthRef.current && lastRef.current) {
      lastRef.current.focus()
    }
    prevLengthRef.current = honors.length
  }, [honors.length])

  // Honors are optional, but any row with a typed title must be a real title
  // with a level selected — blocks "Jjj"-style junk from being submitted.
  const startedRows = honors.filter(h => h.title?.trim())
  const hasJunk = startedRows.some(h => !isValidHonorTitle(h.title) || !h.level)
  const canContinue = !hasJunk

  return (
    <div className={`question-slide slide-${direction}`}>
      <div className="slide-header">
        <span className="section-label">{sectionLabel}</span>
        <span className="q-counter">{counter}</span>
      </div>

      <div className="question-text">What are your top honors and awards?</div>
      {hasJunk && (
        <div className="question-hint question-hint--warn">
          Give each honor a real name (at least {MIN_HONOR_CHARS} characters) and pick its level, or remove the row.
        </div>
      )}

      <div className="list-input-list">
        {honors.map((honor, i) => (
          <div key={i} className="list-input-row">
            <input
              ref={i === honors.length - 1 ? lastRef : null}
              className="list-input-field"
              type="text"
              placeholder={`Honor ${i + 1}`}
              value={honor.title}
              onChange={e => onUpdate(i, 'title', e.target.value)}
            />
            <HonorLevelDropdown
              value={honor.level}
              onChange={v => onUpdate(i, 'level', v)}
            />
            <button className="list-remove-btn" onClick={() => onRemove(i)} aria-label="Remove">✕</button>
          </div>
        ))}

        {honors.length < MAX && (
          <button className="list-add-btn" onClick={onAdd}>+ Add honor</button>
        )}
      </div>

      <div className="slide-footer">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <button
          className={`next-btn${canContinue ? ' active' : ''}`}
          onClick={canContinue ? onNext : undefined}
        >Continue →</button>
      </div>
    </div>
  )
}
