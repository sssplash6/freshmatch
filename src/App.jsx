import { QuizProvider, useQuiz } from './context/QuizContext'
import Section1 from './phases/Section1'
import Interstitial from './phases/Interstitial'
import Section2 from './phases/Section2'

function Quiz() {
  const { state } = useQuiz()
  if (state.phase === 'interstitial') return <Interstitial />
  if (state.phase === 'section2') return <Section2 />
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
