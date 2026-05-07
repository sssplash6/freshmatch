import '../styles/QuestionSlide.css'
import Option from './Option'

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
}) {
  const canContinue = selectedLetter != null

  return (
    <div className={`question-slide slide-${direction}`}>
      <div className="slide-header">
        <span className="section-label">{sectionLabel}</span>
        <span className="q-counter">{counter}</span>
      </div>

      <div className="question-text">{question.text}</div>

      <div className="options">
        {question.options.map(opt => (
          <Option
            key={opt.letter}
            letter={opt.letter}
            text={opt.text}
            selected={selectedLetter === opt.letter}
            dimmed={selectedLetter != null && selectedLetter !== opt.letter}
            onClick={() => onSelect(opt.letter)}
          />
        ))}
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
