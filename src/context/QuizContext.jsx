import { createContext, useContext, useReducer } from 'react'
import { buildSection1 } from '../data/questions'

export const initialState = {
  phase: 'landing',
  currentIndex: 0,
  name: '',
  email: '',
  country: '',
  schoolName: '',
  grade: '',
  section1Answers: [],
  personalityAnswers: {},
  testScores: { gpa: '', gpaScale: '4', ielts: '', sat: '', alevels: null, ib: null, ap: null, predicted: false },
  extracurriculars: Array(5).fill(null).map(() => ({ description: '' })),
  honors: [{ title: '', level: '' }],
  essay: '',
  majors: [],
  dreamSchools: [],
  efc: null,
  consentData: false,    // required — generate results
  consentOffers: false,  // optional — curated offers
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
    case 'SET_COUNTRY':
      return { ...state, country: action.value }
    case 'SET_SCHOOL_NAME':
      return { ...state, schoolName: action.value }
    case 'SET_GRADE':
      return { ...state, grade: action.value }
    case 'ANSWER': {
      const answers = [...state.section1Answers]
      answers[state.currentIndex] = action.letter
      return { ...state, section1Answers: answers }
    }
    case 'ANSWER_PERSONALITY':
      return {
        ...state,
        personalityAnswers: { ...state.personalityAnswers, [action.id]: action.letter },
      }
    case 'NEXT': {
      if (state.phase === 'intake') {
        if (state.currentIndex === 0) {
          return { ...state, currentIndex: 1, direction: 'forward' }
        }
        return { ...state, phase: 'section1', currentIndex: 0, direction: 'forward' }
      }
      if (state.phase === 'section1') {
        if (state.currentIndex < buildSection1(state.essay).length - 1) {
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
      if (state.phase === 'section1') {
        if (state.currentIndex > 0) {
          return { ...state, currentIndex: state.currentIndex - 1, direction: 'back' }
        }
        return { ...state, phase: 'intake', currentIndex: 0, direction: 'back' }
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
      return { ...state, honors: [...state.honors, { title: '', level: '' }] }
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
    case 'SET_MAJORS':
      return { ...state, majors: action.value }
    case 'SET_DREAM_SCHOOLS':
      return { ...state, dreamSchools: action.value }
    case 'SET_EFC':
      return { ...state, efc: action.value }
    case 'SET_CONSENT':
      return { ...state, [action.field]: action.value }
    case 'UNLOCK':
      return { ...state, phase: 'landing', direction: 'forward' }
    case 'RESTART':
      return initialState
    default:
      return state
  }
}

const QuizContext = createContext(null)

// Start at the access gate unless this session has already been unlocked.
// RESTART returns to `landing` (initialState), so starting over never re-gates.
function init() {
  const unlocked = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('fa-unlocked') === '1'
  return unlocked ? initialState : { ...initialState, phase: 'gate' }
}

export function QuizProvider({ children }) {
  const [state, dispatch] = useReducer(quizReducer, undefined, init)
  return <QuizContext.Provider value={{ state, dispatch }}>{children}</QuizContext.Provider>
}

export function useQuiz() {
  const ctx = useContext(QuizContext)
  if (!ctx) throw new Error('useQuiz must be used within QuizProvider')
  return ctx
}
