import { QuizProvider, useQuiz } from './context/QuizContext'
import Section1 from './phases/Section1'
import Interstitial from './phases/Interstitial'

function Quiz() {
  const { state } = useQuiz()
  if (state.phase === 'interstitial') return <Interstitial />
  return <Section1 />
}

export default function App() {
  return (
    <div className="app">
      <QuizProvider>
        <Quiz />
      </QuizProvider>
    </div>
  )
}
