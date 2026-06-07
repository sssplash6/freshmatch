import { createContext, useContext, useReducer } from 'react'
import { section1 } from '../data/questions'

export const initialState = {
  phase: 'landing',
  currentIndex: 0,
  name: '',
  email: '',
  section1Answers: [],
  testScores: { gpa: '', gpaScale: '4', ielts: '', sat: '', alevels: null, ib: null, ap: null },
  extracurriculars: Array(5).fill(null).map(() => ({ description: '' })),
  honors: [{ title: '', level: '', participants: '' }],
  essay: '',
  efc: null,
  direction: 'forward',
}

export function quizReducer(state, action) {
  switch (action.type) {
    case 'START':
      return { ...state, phase: 'intake', currentIndex: 0, direction: 'forward' }
    case 'COMPLETE_INTAKE':
      return { ...state, phase: 'section1', currentIndex: 0, direction: 'forward' }
    case 'SET_NAME':
      return { ...state, name: action.value }
    case 'SET_EMAIL':
      return { ...state, email: action.value }
    case 'ANSWER': {
      const answers = [...state.section1Answers]
      answers[state.currentIndex] = action.letter
      return { ...state, section1Answers: answers }
    }
    case 'NEXT': {
      if (state.phase === 'intake') {
        if (state.currentIndex === 0) {
          return { ...state, currentIndex: 1, direction: 'forward' }
        }
        return { ...state, phase: 'section1', currentIndex: 0, direction: 'forward' }
      }
      if (state.phase === 'section1') {
        if (state.currentIndex < section1.length - 1) {
          return { ...state, currentIndex: state.currentIndex + 1, direction: 'forward' }
        }
        return { ...state, phase: 'results', direction: 'forward' }
      }
      return state
    }
    case 'BACK': {
      if (state.phase === 'intake') {
        if (state.currentIndex === 0) {
          return { ...state, phase: 'landing', direction: 'back' }
        }
        return { ...state, currentIndex: 0, direction: 'back' }
      }
      if (state.phase === 'section1' && state.currentIndex > 0) {
        return { ...state, currentIndex: state.currentIndex - 1, direction: 'back' }
      }
      return state
    }
    case 'ADD_EC':
      return { ...state, extracurriculars: [...state.extracurriculars, { description: '' }] }
    case 'UPDATE_EC': {
      const extracurriculars = state.extracurriculars.map((e, i) =>
        i === action.index ? { description: action.value } : e
      )
      return { ...state, extracurriculars }
    }
    case 'REMOVE_EC':
      return { ...state, extracurriculars: state.extracurriculars.filter((_, i) => i !== action.index) }
    case 'ADD_HONOR':
      return { ...state, honors: [...state.honors, { title: '', level: '', participants: '' }] }
    case 'UPDATE_HONOR': {
      const honors = state.honors.map((h, i) =>
        i === action.index ? { ...h, [action.field]: action.value } : h
      )
      return { ...state, honors }
    }
    case 'REMOVE_HONOR':
      return { ...state, honors: state.honors.filter((_, i) => i !== action.index) }
    case 'UPDATE_TEST':
      return { ...state, testScores: { ...state.testScores, [action.field]: action.value } }
    case 'ADD_OPTIONAL_TEST':
      return { ...state, testScores: { ...state.testScores, [action.field]: '' } }
    case 'REMOVE_OPTIONAL_TEST':
      return { ...state, testScores: { ...state.testScores, [action.field]: null } }
    case 'UPDATE_ESSAY':
      return { ...state, essay: action.value }
    case 'SET_EFC':
      return { ...state, efc: action.value }
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
