import { useEffect, useRef } from 'react'
import '../styles/QuestionSlide.css'
import Option from './Option'

const ADVANCE_DELAY = 567 // ms — long enough to register the selection before moving on

export default function QuestionSlide({
  question,
  selectedLetter,
  onSelect,
  onNext,
  onBack,
  showBack,
  direction,
  sectionLabel,
  counter,
  isFinal = false,
}) {
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  function handleSelect(letter) {
    onSelect(letter)
    // Auto-advance on every question except the final one, which gets an
    // explicit "see your results" action so the reveal stays deliberate.
    if (!isFinal) {
      clearTimeout(timer.current)
      timer.current = setTimeout(() => onNext(), ADVANCE_DELAY)
    }
  }

  const canContinue = selectedLetter != null

  return (
    <div className={`question-slide slide-${direction}`}>
      <div className="slide-header">
        <span className="section-label">{sectionLabel}</span>
        <span className="q-counter">{counter}</span>
      </div>

      <div className="question-text">{question.text}</div>

      <div className="options" role="group" aria-label={sectionLabel}>
        {question.options.map(opt => (
          <Option
            key={opt.letter}
            letter={opt.letter}
            text={opt.text}
            selected={selectedLetter === opt.letter}
            dimmed={selectedLetter != null && selectedLetter !== opt.letter}
            onClick={() => handleSelect(opt.letter)}
          />
        ))}
      </div>

      <div className="slide-footer">
        {showBack
          ? <button className="back-btn" onClick={onBack}>← Back</button>
          : <span />}
        {isFinal && (
          <button
            className={`next-btn${canContinue ? ' active' : ''}`}
            onClick={canContinue ? onNext : undefined}
          >
            See your results →
          </button>
        )}
      </div>
    </div>
  )
}
