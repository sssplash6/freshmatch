import { isRealEssay, MIN_ESSAY_CHARS } from '../utils/validation'
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
  // The essay is optional. Anything below the real-essay threshold (e.g. "Jj")
  // is treated as a skip: clear it so it isn't stored or fed to scoring, and the
  // personality quiz takes its place.
  const counts = isRealEssay(essay)
  function handleNext() {
    if (!counts && essay.trim()) onUpdate('')
    onNext()
  }
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
        {essay.trim() && !counts && (
          <div className="question-hint question-hint--warn">
            A real essay needs at least {MIN_ESSAY_CHARS} characters — otherwise we'll skip it and ask a few quick questions instead.
          </div>
        )}
      </div>

      <div className="slide-footer">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <button className="next-btn active" onClick={handleNext}>
          {counts ? 'Continue →' : 'Skip →'}
        </button>
      </div>
    </div>
  )
}
