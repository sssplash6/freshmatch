import { useQuiz } from '../context/QuizContext'
import { section1 } from '../data/questions'
import ProgressBar from '../components/ProgressBar'
import QuestionSlide from '../components/QuestionSlide'

// 4 (s1) + 10 (s2) = 14 questions; progress is tracked over these.
const TOTAL_QUESTIONS = 14

export default function Section1() {
  const { state, dispatch } = useQuiz()
  const { currentIndex, section1Answers, direction } = state

  const question = section1[currentIndex]
  const selectedLetter = section1Answers[currentIndex] ?? null
  const overall = currentIndex + 1
  const percent = (overall / TOTAL_QUESTIONS) * 100

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
        showBack={currentIndex > 0}
        direction={direction}
        sectionLabel="Section 1 — Portfolio"
        counter={`${overall} / ${TOTAL_QUESTIONS}`}
      />
    </div>
  )
}
