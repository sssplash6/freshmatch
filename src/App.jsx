import { useEffect, useState } from 'react'
import { QuizProvider, useQuiz } from './context/QuizContext'
import Landing from './phases/Landing'
import Intake from './phases/Intake'
import Section1 from './phases/Section1'
import Results from './phases/Results'
import Admin from './admin/Admin'

function Quiz() {
  const { state } = useQuiz()
  switch (state.phase) {
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
      {theme === 'dark' ? '○ Light' : '◑ Dark'}
    </button>
  )
}

export default function App() {
  // The /admin scouting dashboard is a separate surface from the quiz. The SPA
  // fallback serves index.html for /admin, so we branch on the path here.
  const isAdmin = typeof window !== 'undefined'
    && window.location.pathname.replace(/\/+$/, '') === '/admin'

  return (
    <div className="app">
      {isAdmin ? (
        <Admin />
      ) : (
        <QuizProvider>
          <Quiz />
        </QuizProvider>
      )}
      <ThemeToggle />
    </div>
  )
}
