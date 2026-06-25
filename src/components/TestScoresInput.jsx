import { useState, useEffect, useRef } from 'react'
import { isValidSat, isValidIelts, isValidGpa } from '../utils/validation'
import '../styles/TestScoresInput.css'

const GPA_SCALES = ['4', '5', '10', '100']

function GpaScaleDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDown(e) { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div className="gpa-scale-wrap" ref={ref}>
      <button
        type="button"
        className="gpa-scale-btn"
        onClick={() => setOpen(o => !o)}
        aria-label="GPA scale"
        aria-expanded={open}
      >
        /{value}<span className="gpa-scale-caret">▾</span>
      </button>
      {open && (
        <ul className="gpa-scale-menu">
          {GPA_SCALES.map(opt => (
            <li
              key={opt}
              className={`gpa-scale-opt${opt === value ? ' gpa-scale-opt--on' : ''}`}
              onMouseDown={() => { onChange(opt); setOpen(false) }}
            >
              /{opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const REQUIRED = [
  { field: 'gpa',   label: 'GPA' },
  { field: 'ielts', label: 'IELTS' },
  { field: 'sat',   label: 'SAT' },
]

const OPTIONAL = [
  { field: 'alevels', label: 'A Levels' },
  { field: 'ib',      label: 'IB' },
  { field: 'ap',      label: 'AP' },
]

export default function TestScoresInput({
  testScores,
  onUpdate,
  onAddOptional,
  onRemoveOptional,
  onNext,
  onBack,
  direction,
  sectionLabel,
  counter,
}) {
  const unadded = OPTIONAL.filter(t => testScores[t.field] === null)
  const added   = OPTIONAL.filter(t => testScores[t.field] !== null)

  // GPA, IELTS, and SAT are all required — students without a given score enter "N/A".
  const allFilled = REQUIRED.every(({ field }) => String(testScores[field] ?? '').trim())
  // Real numbers must be in range — blocks SAT 9999, GPA 99/4, IELTS 50.
  const badScores = [
    !isValidSat(testScores.sat)                        && 'SAT (400–1600)',
    !isValidIelts(testScores.ielts)                    && 'IELTS (0–9)',
    !isValidGpa(testScores.gpa, testScores.gpaScale)   && `GPA (0–${testScores.gpaScale || 4})`,
  ].filter(Boolean)
  const canContinue = allFilled && badScores.length === 0

  return (
    <div className={`question-slide slide-${direction}`}>
      <div className="slide-header">
        <span className="section-label">{sectionLabel}</span>
        <span className="q-counter">{counter}</span>
      </div>

      <div className="question-text">What standardized test scores do you have?</div>
      <div className="question-hint">
        GPA, IELTS, and SAT are required. Enter <strong>N/A</strong> for any you don't have.
      </div>
      {badScores.length > 0 && (
        <div className="question-hint question-hint--warn">
          Please enter a valid {badScores.join(', ')}, or N/A.
        </div>
      )}

      <div className="test-scores-list">
        {REQUIRED.map(({ field, label }) => (
          <div key={field} className="test-score-row">
            <span className="test-type-label">{label}</span>
            <input
              className="test-input test-score-input"
              type="text"
              placeholder="Score or N/A"
              value={testScores[field]}
              onChange={e => onUpdate(field, e.target.value)}
            />
            {field === 'gpa' && (
              <GpaScaleDropdown
                value={testScores.gpaScale}
                onChange={val => onUpdate('gpaScale', val)}
              />
            )}
          </div>
        ))}

        {added.map(({ field, label }) => (
          <div key={field} className="test-score-row">
            <span className="test-type-label">{label}</span>
            <input
              className="test-input test-score-input"
              type="text"
              placeholder="Score"
              value={testScores[field]}
              onChange={e => onUpdate(field, e.target.value)}
            />
            <button className="test-remove-btn" onClick={() => onRemoveOptional(field)} aria-label={`Remove ${label}`}>✕</button>
          </div>
        ))}

        {unadded.length > 0 && (
          <div className="test-optional-btns">
            {unadded.map(({ field, label }) => (
              <button key={field} className="test-add-btn" onClick={() => onAddOptional(field)}>
                ⊕ {label}
              </button>
            ))}
          </div>
        )}

        <label className="test-predicted">
          <input
            type="checkbox"
            checked={!!testScores.predicted}
            onChange={e => onUpdate('predicted', e.target.checked)}
          />
          <span>These are predicted grades (not yet final)</span>
        </label>
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
