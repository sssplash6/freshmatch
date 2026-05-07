import { createContext, useContext, useReducer } from 'react'
import { section1, section2 } from '../data/questions'

export const initialState = {
  phase: 'section1',
  currentIndex: 0,
  section1Answers: [],
  section2Answers: [],
  direction: 'forward',
}

export function quizReducer(state, action) {
  switch (action.type) {
    case 'ANSWER': {
      const key = state.phase === 'section2' ? 'section2Answers' : 'section1Answers'
      const answers = [...state[key]]
      answers[state.currentIndex] = action.letter
      return { ...state, [key]: answers }
    }
    case 'NEXT': {
      if (state.phase === 'section1') {
        if (state.currentIndex < section1.length - 1) {
          return { ...state, currentIndex: state.currentIndex + 1, direction: 'forward' }
        }
        return { ...state, phase: 'interstitial', currentIndex: 0, direction: 'forward' }
      }
      if (state.phase === 'interstitial') {
        return { ...state, phase: 'section2', currentIndex: 0, direction: 'forward' }
      }
      if (state.phase === 'section2') {
        if (state.currentIndex < section2.length - 1) {
          return { ...state, currentIndex: state.currentIndex + 1, direction: 'forward' }
        }
        return { ...state, phase: 'results', direction: 'forward' }
      }
      return state
    }
    case 'BACK': {
      if (state.phase === 'section1' && state.currentIndex > 0) {
        return { ...state, currentIndex: state.currentIndex - 1, direction: 'back' }
      }
      if (state.phase === 'interstitial') {
        return { ...state, phase: 'section1', currentIndex: section1.length - 1, direction: 'back' }
      }
      if (state.phase === 'section2') {
        if (state.currentIndex > 0) {
          return { ...state, currentIndex: state.currentIndex - 1, direction: 'back' }
        }
        return { ...state, phase: 'interstitial', currentIndex: 0, direction: 'back' }
      }
      return state
    }
    case 'RESTART':
      return initialState
    default:
      return state
  }
}

const QuizContext = createContext(null)

export function QuizProvider({ children }) {
  const [state, dispatch] = useReducer(quizReducer, initialState)
  return <QuizContext.Provider value={{ state, dispatch }}>{children}</QuizContext.Provider>
}

export function useQuiz() {
  const ctx = useContext(QuizContext)
  if (!ctx) throw new Error('useQuiz must be used within QuizProvider')
  return ctx
}
