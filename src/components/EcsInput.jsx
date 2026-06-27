import { useEffect, useRef } from 'react'
import { isSubstantiveEc, MIN_EC_CHARS } from '../utils/validation'
import '../styles/EcsInput.css'

const MAX = 8
const MIN = 5

function autoResize(el) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}

export default function EcsInput({
  extracurriculars,
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
  const prevLengthRef = useRef(extracurriculars.length)

  // At least 5 *substantive* activities must be filled in before continuing —
  // single letters or repeated characters don't count.
  const filledCount = extracurriculars.filter(e => isSubstantiveEc(e.description)).length
  const canContinue = filledCount >= MIN
  // Flag rows that have text but aren't substantive, so the user knows why they're stuck.
  const hasJunk = extracurriculars.some(e => e.description.trim() && !isSubstantiveEc(e.description))

  useEffect(() => {
    if (extracurriculars.length > prevLengthRef.current && lastRef.current) {
      lastRef.current.focus()
    }
    prevLengthRef.current = extracurriculars.length
  }, [extracurriculars.length])

  return (
    <div className={`question-slide slide-${direction}`}>
      <div className="slide-header">
        <span className="section-label">{sectionLabel}</span>
        <span className="q-counter">{counter}</span>
      </div>

      <div className="question-text">What are your extracurricular activities?</div>
      <div className="question-hint">
        5 required, up to 8 total. For each, qualify and quantify its scale and impact, and what inspired you to pursue it.
      </div>
      {hasJunk && (
        <div className="question-hint question-hint--warn">
          Please give each activity a real, specific description (at least {MIN_EC_CHARS} characters) — placeholder or mashed-up text doesn't count.
        </div>
      )}

      <div className="list-input-list">
        {extracurriculars.map((ec, i) => (
          <div key={i} className="list-input-row ec-row">
            <textarea
              ref={i === extracurriculars.length - 1 ? lastRef : null}
              className="list-input-field ec-textarea"
              placeholder={`Activity ${i + 1}`}
              value={ec.description}
              rows={2}
              onChange={e => {
                onUpdate(i, e.target.value)
                autoResize(e.target)
              }}
              onFocus={e => autoResize(e.target)}
            />
            {extracurriculars.length > MIN && (
              <button className="list-remove-btn" onClick={() => onRemove(i)} aria-label="Remove">✕</button>
            )}
          </div>
        ))}

        {extracurriculars.length < MAX && (
          <button className="list-add-btn" onClick={onAdd}>+ Add activity</button>
        )}
      </div>

      <div className="slide-footer">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <button
          className={`next-btn${canContinue ? ' active' : ''}`}
          onClick={canContinue ? onNext : undefined}
        >
          Continue →
        </button>
      </div>
    </div>
  )
}
