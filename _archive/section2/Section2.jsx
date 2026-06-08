import { useQuiz } from '../context/QuizContext'
import { section2 } from '../data/questions'
import ProgressBar from '../components/ProgressBar'
import QuestionSlide from '../components/QuestionSlide'

const TOTAL_QUESTIONS = 14
const S2_OFFSET = 4 // 4 section-1 questions come first

export default function Section2() {
  const { state, dispatch } = useQuiz()
  const { currentIndex, section2Answers, direction } = state

  const question = section2[currentIndex]
  const selectedLetter = section2Answers[currentIndex] ?? null
  const overall = S2_OFFSET + currentIndex + 1
  const percent = (overall / TOTAL_QUESTIONS) * 100
  const isFinal = currentIndex === section2.length - 1

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
        counter={`${overall} / ${TOTAL_QUESTIONS}`}
        isFinal={isFinal}
      />
    </div>
  )
}
