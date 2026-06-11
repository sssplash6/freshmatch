import { useEffect, useState } from 'react'
import { QuizProvider, useQuiz } from './context/QuizContext'
import Gate from './phases/Gate'
import Landing from './phases/Landing'
import Intake from './phases/Intake'
import Section1 from './phases/Section1'
import Results from './phases/Results'

function Quiz() {
  const { state } = useQuiz()
  switch (state.phase) {
    case 'gate':    return <Gate />
    case 'landing': return <Landing />
    case 'intake':  return <Intake />
    case 'results': return <Results />
    default:        return <Section1 />
  }
}

function ThemeToggle() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem('fa-theme') || 'dark'
  )

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('fa-theme', theme)
  }, [theme])

  const next = theme === 'dark' ? 'light' : 'dark'

  return (
    <button
      className="theme-toggle"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} theme`}
    >
      {theme === 'dark' ? '☀ Light' : '◑ Dark'}
    </button>
  )
}

export default function App() {
  return (
    <div className="app">
      <QuizProvider>
        <Quiz />
      </QuizProvider>
      <ThemeToggle />
    </div>
  )
}
