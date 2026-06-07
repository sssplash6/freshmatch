import { useRef, useEffect } from 'react'
import '../styles/IntakeSlide.css'

export default function IntakeSlide({
  question,
  placeholder,
  type,
  value,
  canContinue,
  onChange,
  onNext,
  onBack,
  showBack,
  direction,
}) {
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleKeyDown(e) {
    if (e.key === 'Enter' && canContinue) onNext()
  }

  return (
    <div className={`question-slide slide-${direction}`}>
      <div className="question-text intake-question">{question}</div>

      <div className="intake-field-wrap">
        <input
          ref={inputRef}
          className="intake-input"
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
      </div>

      <div className="slide-footer">
        {showBack
          ? <button className="back-btn" onClick={onBack}>← Back</button>
          : <span />}
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
