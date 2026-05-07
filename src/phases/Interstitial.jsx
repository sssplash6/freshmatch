import '../styles/Interstitial.css'
import { useQuiz } from '../context/QuizContext'
import ProgressBar from '../components/ProgressBar'

const TOTAL_STEPS = 15
const INTERSTITIAL_STEP = 5

export default function Interstitial() {
  const { dispatch } = useQuiz()

  return (
    <div className="card">
      <ProgressBar percent={(INTERSTITIAL_STEP / TOTAL_STEPS) * 100} />
      <div className="interstitial">
        <div className="interstitial-eyebrow">Section 1 Complete</div>
        <div className="interstitial-divider" />
        <div className="interstitial-title">
          Now, let's explore<br />how you think.
        </div>
        <div className="interstitial-sub">
          Section 2 helps us understand which university culture fits your intellectual style.
        </div>
        <div className="interstitial-divider" />
        <button className="interstitial-begin" onClick={() => dispatch({ type: 'NEXT' })}>
          Begin Section 2 →
        </button>
      </div>
    </div>
  )
}
