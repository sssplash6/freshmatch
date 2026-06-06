import '../styles/Results.css'
import { useState } from 'react'
import { useQuiz } from '../context/QuizContext'
import { getResult } from '../utils/scoring'
import SchoolRow from '../components/SchoolRow'

export default function Results() {
  const { state, dispatch } = useQuiz()
  const { section1Answers, section2Answers } = state
  const result = getResult(section1Answers, section2Answers)

  const fitSchools = result.schools.filter(s => !s.adjusted)
  const realisticSchools = result.schools.filter(s => s.adjusted)

  const [copied, setCopied] = useState(false)
  function handleShare() {
    const text = [
      `Admissions Fit — ${result.label}`,
      fitSchools.length ? `Best fit: ${fitSchools.map(s => s.name).join(', ')}` : '',
      realisticSchools.length ? `Realistic: ${realisticSchools.map(s => s.name).join(', ')}` : '',
    ].filter(Boolean).join('\n')

    navigator.clipboard?.writeText(text)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {})
  }

  return (
    <div className="card results-wide">
      <div className="results">
        <div className="results-complete res-rise" style={{ animationDelay: '0ms' }}>
          <span className="results-check">✓</span> Assessment complete
        </div>

        <div className="results-eyebrow res-rise" style={{ animationDelay: '60ms' }}>Your Fit</div>
        <div className="results-title res-rise" style={{ animationDelay: '110ms' }}>{result.label}</div>
        <div className="results-desc res-rise" style={{ animationDelay: '170ms' }}>{result.description}</div>
        <div className="results-divider res-rise" style={{ animationDelay: '220ms' }} />

        {result.noSchools ? (
          <div className="res-rise" style={{ animationDelay: '260ms' }}>
            <div className="schools-label">Recommended Schools</div>
            <div className="no-schools-msg">
              Your academic profile would benefit from strengthening before targeting these universities.
            </div>
          </div>
        ) : (
          <div className="schools-cols">
            <div className="schools-group best">
              <div className="schools-label accent res-rise" style={{ animationDelay: '270ms' }}>Best Fit</div>
              <div className="schools-caption res-rise" style={{ animationDelay: '310ms' }}>
                Where you belong by temperament — schools matched to how you think and what drives you, regardless of where your academics stand today.
              </div>
              <div className="school-list">
                {fitSchools.map((s, i) => (
                  <SchoolRow key={s.name} name={s.name} accent delay={350 + i * 45} />
                ))}
              </div>
            </div>

            {realisticSchools.length > 0 && (
              <div className="schools-group realistic">
                <div className="schools-label res-rise" style={{ animationDelay: '420ms' }}>Realistic For Your Profile</div>
                <div className="schools-caption res-rise" style={{ animationDelay: '460ms' }}>
                  Realistic schools you'd fit based on your current academic profile — the same kind of environment, adjusted to where you actually stand.
                </div>
                <div className="school-list">
                  {realisticSchools.map((s, i) => (
                    <SchoolRow key={s.name} name={s.name} delay={500 + i * 45} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="results-actions res-rise" style={{ animationDelay: '560ms' }}>
          <button className="results-share" onClick={handleShare}>
            {copied ? 'Copied ✓' : 'Copy result'}
          </button>
          <button className="restart-btn" onClick={() => dispatch({ type: 'RESTART' })}>
            ↺ Start Over
          </button>
        </div>
      </div>
    </div>
  )
}
