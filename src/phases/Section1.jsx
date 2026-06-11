import { useQuiz } from '../context/QuizContext'
import { buildSection1 } from '../data/questions'
import ProgressBar from '../components/ProgressBar'
import QuestionSlide from '../components/QuestionSlide'
import TestScoresInput from '../components/TestScoresInput'
import EcsInput from '../components/EcsInput'
import HonorsInput from '../components/HonorsInput'
import EssayInput from '../components/EssayInput'
import EfcSlide from '../components/EfcSlide'
import DreamSchoolSearch from '../components/DreamSchoolSearch'
import MajorSearch from '../components/MajorSearch'

export default function Section1() {
  const { state, dispatch } = useQuiz()
  const { currentIndex, section1Answers, personalityAnswers, testScores, extracurriculars, honors, essay, majors, dreamSchools, efc, direction } = state

  const questions = buildSection1(essay)
  const totalQuestions = questions.length
  const question = questions[currentIndex]
  const selectedLetter = section1Answers[currentIndex] ?? null
  const overall = currentIndex + 1
  const percent = (overall / totalQuestions) * 100

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
    counter: `${overall} / ${totalQuestions}`,
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
      ) : question.type === 'majors' ? (
        <MajorSearch
          key={question.id}
          value={majors}
          onChange={value => dispatch({ type: 'SET_MAJORS', value })}
          {...sharedProps}
        />
      ) : question.type === 'dream-schools' ? (
        <DreamSchoolSearch
          key={question.id}
          value={dreamSchools}
          onChange={value => dispatch({ type: 'SET_DREAM_SCHOOLS', value })}
          {...sharedProps}
        />
      ) : question.type === 'efc' ? (
        <EfcSlide
          key={question.id}
          efc={efc}
          onUpdate={value => dispatch({ type: 'SET_EFC', value })}
          {...sharedProps}
        />
      ) : question.type === 'personality' ? (
        <QuestionSlide
          key={question.id}
          question={question}
          selectedLetter={personalityAnswers[question.id] ?? null}
          onSelect={letter => dispatch({ type: 'ANSWER_PERSONALITY', id: question.id, letter })}
          showBack={currentIndex > 0}
          {...sharedProps}
          sectionLabel="Section 1 — Personality"
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
