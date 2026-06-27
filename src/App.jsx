import { useEffect, useState } from 'react'
import { QuizProvider, useQuiz } from './context/QuizContext'
import Landing from './phases/Landing'
import Intake from './phases/Intake'
import Section1 from './phases/Section1'
import Results from './phases/Results'
import SharedResults from './phases/SharedResults'
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
  // /admin (scouting dashboard) and /r/:token (shared results) are separate
  // surfaces from the quiz. The SPA fallback serves index.html for both, so we
  // branch on the path here rather than pulling in a router.
  const path = typeof window !== 'undefined'
    ? window.location.pathname.replace(/\/+$/, '')
    : ''
  const isAdmin = path === '/admin'
  const shareMatch = path.match(/^\/r\/([A-Za-z0-9_-]+)$/)

  let surface
  if (isAdmin) {
    surface = <Admin />
  } else if (shareMatch) {
    surface = <SharedResults token={shareMatch[1]} />
  } else {
    surface = (
      <QuizProvider>
        <Quiz />
      </QuizProvider>
    )
  }

  return (
    <div className="app">
      {surface}
      <ThemeToggle />
    </div>
  )
}
