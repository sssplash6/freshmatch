import { useQuiz } from '../context/QuizContext'
import { section1 } from '../data/questions'
import ProgressBar from '../components/ProgressBar'
import QuestionSlide from '../components/QuestionSlide'
import TestScoresInput from '../components/TestScoresInput'
import EcsInput from '../components/EcsInput'
import HonorsInput from '../components/HonorsInput'
import EssayInput from '../components/EssayInput'
import EfcSlide from '../components/EfcSlide'

const TOTAL_QUESTIONS = section1.length

export default function Section1() {
  const { state, dispatch } = useQuiz()
  const { currentIndex, section1Answers, testScores, extracurriculars, honors, essay, efc, direction } = state

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

  const sharedProps = {
    direction,
    sectionLabel: 'Section 1 — Portfolio',
    counter: `${overall} / ${TOTAL_QUESTIONS}`,
    onNext: handleNext,
    onBack: handleBack,
  }

  return (
    <div className="card">
      <ProgressBar percent={percent} />
      {question.type === 'extracurriculars' ? (
        <EcsInput
          key={question.id}
          extracurriculars={extracurriculars}
          onAdd={() => dispatch({ type: 'ADD_EC' })}
          onUpdate={(index, value) => dispatch({ type: 'UPDATE_EC', index, value })}
          onRemove={index => dispatch({ type: 'REMOVE_EC', index })}
          {...sharedProps}
        />
      ) : question.type === 'honors' ? (
        <HonorsInput
          key={question.id}
          honors={honors}
          onAdd={() => dispatch({ type: 'ADD_HONOR' })}
          onUpdate={(index, field, value) => dispatch({ type: 'UPDATE_HONOR', index, field, value })}
          onRemove={index => dispatch({ type: 'REMOVE_HONOR', index })}
          {...sharedProps}
        />
      ) : question.type === 'test-scores' ? (
        <TestScoresInput
          key={question.id}
          testScores={testScores}
          onUpdate={(field, value) => dispatch({ type: 'UPDATE_TEST', field, value })}
          onAddOptional={field => dispatch({ type: 'ADD_OPTIONAL_TEST', field })}
          onRemoveOptional={field => dispatch({ type: 'REMOVE_OPTIONAL_TEST', field })}
          {...sharedProps}
        />
      ) : question.type === 'essay' ? (
        <EssayInput
          key={question.id}
          essay={essay}
          onUpdate={value => dispatch({ type: 'UPDATE_ESSAY', value })}
          {...sharedProps}
        />
      ) : question.type === 'efc' ? (
        <EfcSlide
          key={question.id}
          efc={efc}
          onUpdate={value => dispatch({ type: 'SET_EFC', value })}
          {...sharedProps}
        />
      ) : (
        <QuestionSlide
          key={question.id}
          question={question}
          selectedLetter={selectedLetter}
          onSelect={handleSelect}
          showBack={currentIndex > 0}
          {...sharedProps}
        />
      )}
    </div>
  )
}
