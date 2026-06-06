import { QuizProvider, useQuiz } from './context/QuizContext'
import Landing from './phases/Landing'
import Section1 from './phases/Section1'
import Interstitial from './phases/Interstitial'
import Section2 from './phases/Section2'
import Results from './phases/Results'

function Quiz() {
  const { state } = useQuiz()
  switch (state.phase) {
    case 'landing':      return <Landing />
    case 'interstitial': return <Interstitial />
    case 'section2':     return <Section2 />
    case 'results':      return <Results />
    default:             return <Section1 />
  }
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
