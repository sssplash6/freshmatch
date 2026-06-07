import { useRef, useEffect } from 'react'
import { useQuiz } from '../context/QuizContext'
import '../styles/IntakeSlide.css'

export default function Intake() {
  const { state, dispatch } = useQuiz()
  const { name, email } = state
  const nameRef = useRef(null)

  useEffect(() => { nameRef.current?.focus() }, [])

  const canContinue = name.trim().length > 0 && email.trim().length > 0 && email.includes('@')

  function handleKeyDown(e) {
    if (e.key === 'Enter' && canContinue) dispatch({ type: 'COMPLETE_INTAKE' })
  }

  return (
    <div className="card">
      <div className="question-slide slide-forward">
        <div className="question-text intake-question">Personal information</div>

        <div className="intake-fields">
          <div className="intake-field-item">
            <label className="intake-label">Full name</label>
            <input
              ref={nameRef}
              className="intake-input"
              type="text"
              placeholder="Your name"
              value={name}
              onChange={e => dispatch({ type: 'SET_NAME', value: e.target.value })}
              onKeyDown={handleKeyDown}
              autoComplete="off"
            />
          </div>

          <div className="intake-field-item">
            <label className="intake-label">Email address</label>
            <input
              className="intake-input"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => dispatch({ type: 'SET_EMAIL', value: e.target.value })}
              onKeyDown={handleKeyDown}
              autoComplete="off"
            />
          </div>
        </div>

        <div className="slide-footer">
          <button className="back-btn" onClick={() => dispatch({ type: 'BACK' })}>← Back</button>
          <button
            className={`next-btn${canContinue ? ' active' : ''}`}
            onClick={canContinue ? () => dispatch({ type: 'COMPLETE_INTAKE' }) : undefined}
          >
            Continue →
          </button>
        </div>
      </div>
    </div>
  )
}
