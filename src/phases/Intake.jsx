import { useRef, useEffect, useState } from 'react'
import { useQuiz } from '../context/QuizContext'
import CountrySearch from '../components/CountrySearch'
import '../styles/IntakeSlide.css'

const GRADES = ['9th Grade', '10th Grade', '11th Grade', '12th Grade', 'Gap Year']

export default function Intake() {
  const { state, dispatch } = useQuiz()
  const { name, email, country, schoolName, grade } = state
  const [step, setStep] = useState(0)
  const nameRef = useRef(null)
  const schoolRef = useRef(null)

  useEffect(() => {
    if (step === 0) nameRef.current?.focus()
    else schoolRef.current?.focus()
  }, [step])

  const canContinueStep0 = name.trim().length > 0 && email.trim().length > 0 && email.includes('@')
  const canContinueStep1 = country.trim().length > 0 && schoolName.trim().length > 0 && grade !== ''

  function handleKeyDown0(e) {
    if (e.key === 'Enter' && canContinueStep0) setStep(1)
  }

  function handleKeyDown1(e) {
    if (e.key === 'Enter' && canContinueStep1) dispatch({ type: 'COMPLETE_INTAKE' })
  }

  if (step === 0) {
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
                onKeyDown={handleKeyDown0}
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
                onKeyDown={handleKeyDown0}
                autoComplete="off"
              />
            </div>
          </div>

          <div className="slide-footer">
            <button className="back-btn" onClick={() => dispatch({ type: 'BACK' })}>← Back</button>
            <button
              className={`next-btn${canContinueStep0 ? ' active' : ''}`}
              onClick={canContinueStep0 ? () => setStep(1) : undefined}
            >
              Continue →
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="question-slide slide-forward">
        <div className="question-text intake-question">Your school</div>

        <div className="intake-fields">
          <div className="intake-field-item">
            <label className="intake-label">Country</label>
            <CountrySearch
              value={country}
              onChange={v => dispatch({ type: 'SET_COUNTRY', value: v })}
            />
          </div>

          <div className="intake-field-item">
            <label className="intake-label">School name</label>
            <input
              ref={schoolRef}
              className="intake-input"
              type="text"
              placeholder="Your high school"
              value={schoolName}
              onChange={e => dispatch({ type: 'SET_SCHOOL_NAME', value: e.target.value })}
              onKeyDown={handleKeyDown1}
              autoComplete="off"
            />
          </div>

          <div className="intake-field-item">
            <label className="intake-label">Grade</label>
            <div className="grade-pills">
              {GRADES.map(g => (
                <button
                  key={g}
                  className={`grade-pill${grade === g ? ' selected' : ''}`}
                  onClick={() => dispatch({ type: 'SET_GRADE', value: g })}
                  type="button"
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="slide-footer">
          <button className="back-btn" onClick={() => setStep(0)}>← Back</button>
          <button
            className={`next-btn${canContinueStep1 ? ' active' : ''}`}
            onClick={canContinueStep1 ? () => dispatch({ type: 'COMPLETE_INTAKE' }) : undefined}
          >
            Continue →
          </button>
        </div>
      </div>
    </div>
  )
}
