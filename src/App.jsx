import { QuizProvider } from './context/QuizContext'
import Section1 from './phases/Section1'

export default function App() {
  return (
    <div className="app">
      <QuizProvider>
        <Section1 />
      </QuizProvider>
    </div>
  )
}
