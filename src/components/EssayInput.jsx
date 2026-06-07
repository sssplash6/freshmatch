import '../styles/EssayInput.css'

export default function EssayInput({
  essay,
  onUpdate,
  onNext,
  onBack,
  direction,
  sectionLabel,
  counter,
}) {
  return (
    <div className={`question-slide slide-${direction}`}>
      <div className="slide-header">
        <span className="section-label">{sectionLabel}</span>
        <span className="q-counter">{counter}</span>
      </div>

      <div className="question-text">
        Personal essay
        <span className="essay-optional-badge">Optional</span>
      </div>
      <div className="question-hint">
        Share a personal story relevant to finding which college fits you.
      </div>

      <div className="essay-field-wrap">
        <textarea
          className="essay-textarea"
          placeholder="Write your essay here…"
          value={essay}
          onChange={e => onUpdate(e.target.value)}
        />
      </div>

      <div className="slide-footer">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <button className="next-btn active" onClick={onNext}>
          {essay.trim() ? 'Continue →' : 'Skip →'}
        </button>
      </div>
    </div>
  )
}
