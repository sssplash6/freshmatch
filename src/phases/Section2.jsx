import { useQuiz } from '../context/QuizContext'
import { section2 } from '../data/questions'
import ProgressBar from '../components/ProgressBar'
import QuestionSlide from '../components/QuestionSlide'

const TOTAL_STEPS = 15
const S2_OFFSET = 5 // 4 s1 questions + 1 interstitial

export default function Section2() {
  const { state, dispatch } = useQuiz()
  const { currentIndex, section2Answers, direction } = state

  const question = section2[currentIndex]
  const selectedLetter = section2Answers[currentIndex] ?? null
  const percent = ((S2_OFFSET + currentIndex + 1) / TOTAL_STEPS) * 100

  function handleSelect(letter) {
    dispatch({ type: 'ANSWER', letter })
  }

  function handleNext() {
    dispatch({ type: 'NEXT' })
  }

  function handleBack() {
    dispatch({ type: 'BACK' })
  }

  return (
    <div className="card">
      <ProgressBar percent={percent} />
      <QuestionSlide
        key={question.id}
        question={question}
        selectedLetter={selectedLetter}
        onSelect={handleSelect}
        onNext={handleNext}
        onBack={handleBack}
        showBack={true}
        direction={direction}
        sectionLabel="Section 2 — Thinking Style"
        counter={`${currentIndex + 1} / ${section2.length}`}
      />
    </div>
  )
}
