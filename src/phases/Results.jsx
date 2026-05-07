import '../styles/Results.css'
import { useQuiz } from '../context/QuizContext'
import { getResult } from '../utils/scoring'
import ProgressBar from '../components/ProgressBar'

export default function Results() {
  const { state, dispatch } = useQuiz()
  const { section1Answers, section2Answers } = state
  const result = getResult(section1Answers, section2Answers)

  return (
    <div className="card">
      <ProgressBar percent={100} />
      <div className="results">
        <div className="results-eyebrow">Your Fit</div>
        <div className="results-title">{result.label}</div>
        <div className="results-desc">{result.description}</div>
        <div className="results-divider" />

        <div className="schools-label">Recommended Schools</div>

        {result.noSchools ? (
          <div className="no-schools-msg">
            Your academic profile would benefit from strengthening before targeting these universities.
          </div>
        ) : (
          <div className="school-list">
            {result.schools.map((school, i) => (
              <div
                key={i}
                className={`school-item${school.adjusted ? ' adjusted' : ''}`}
              >
                {school.name}{school.adjusted ? ' — adjusted for your profile' : ''}
              </div>
            ))}
          </div>
        )}

        <button className="restart-btn" onClick={() => dispatch({ type: 'RESTART' })}>
          ↺ Start Over
        </button>
      </div>
    </div>
  )
}
