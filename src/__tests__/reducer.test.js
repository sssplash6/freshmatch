import { describe, it, expect } from 'vitest'

// Import the reducer directly (not the Provider) for pure unit testing
import { quizReducer, initialState } from '../context/QuizContext'

// initialState is now the landing screen; quiz logic begins once START fires.
const section1State = { ...initialState, phase: 'section1' }

describe('quizReducer', () => {
  describe('START', () => {
    it('moves from landing into section1', () => {
      expect(initialState.phase).toBe('landing')
      const state = quizReducer(initialState, { type: 'START' })
      expect(state.phase).toBe('section1')
      expect(state.currentIndex).toBe(0)
    })
  })

  describe('ANSWER', () => {
    it('records answer in section1Answers', () => {
      const state = quizReducer(initialState, { type: 'ANSWER', letter: 'B' })
      expect(state.section1Answers[0]).toBe('B')
    })

    it('records answer at correct index', () => {
      const s = { ...initialState, currentIndex: 2 }
      const state = quizReducer(s, { type: 'ANSWER', letter: 'C' })
      expect(state.section1Answers[2]).toBe('C')
    })

    it('records answer in section2Answers when in section2', () => {
      const s = { ...initialState, phase: 'section2', currentIndex: 0 }
      const state = quizReducer(s, { type: 'ANSWER', letter: 'A' })
      expect(state.section2Answers[0]).toBe('A')
    })
  })

  describe('NEXT', () => {
    it('advances currentIndex within section1', () => {
      const state = quizReducer(section1State, { type: 'NEXT' })
      expect(state.currentIndex).toBe(1)
      expect(state.phase).toBe('section1')
      expect(state.direction).toBe('forward')
    })

    it('transitions to interstitial after last section1 question', () => {
      const s = { ...section1State, currentIndex: 3 }
      const state = quizReducer(s, { type: 'NEXT' })
      expect(state.phase).toBe('interstitial')
      expect(state.currentIndex).toBe(0)
    })

    it('transitions from interstitial to section2', () => {
      const s = { ...initialState, phase: 'interstitial' }
      const state = quizReducer(s, { type: 'NEXT' })
      expect(state.phase).toBe('section2')
      expect(state.currentIndex).toBe(0)
    })

    it('advances currentIndex within section2', () => {
      const s = { ...initialState, phase: 'section2', currentIndex: 4 }
      const state = quizReducer(s, { type: 'NEXT' })
      expect(state.currentIndex).toBe(5)
      expect(state.phase).toBe('section2')
    })

    it('transitions to results after last section2 question', () => {
      const s = { ...initialState, phase: 'section2', currentIndex: 9 }
      const state = quizReducer(s, { type: 'NEXT' })
      expect(state.phase).toBe('results')
    })
  })

  describe('BACK', () => {
    it('decrements currentIndex within section1', () => {
      const s = { ...section1State, currentIndex: 2 }
      const state = quizReducer(s, { type: 'BACK' })
      expect(state.currentIndex).toBe(1)
      expect(state.direction).toBe('back')
    })

    it('does nothing on first question of section1', () => {
      const state = quizReducer(section1State, { type: 'BACK' })
      expect(state.currentIndex).toBe(0)
      expect(state.phase).toBe('section1')
    })

    it('goes from interstitial back to last section1 question', () => {
      const s = { ...initialState, phase: 'interstitial' }
      const state = quizReducer(s, { type: 'BACK' })
      expect(state.phase).toBe('section1')
      expect(state.currentIndex).toBe(3)
    })

    it('goes from first section2 question back to interstitial', () => {
      const s = { ...initialState, phase: 'section2', currentIndex: 0 }
      const state = quizReducer(s, { type: 'BACK' })
      expect(state.phase).toBe('interstitial')
    })
  })

  describe('RESTART', () => {
    it('resets to initial state', () => {
      const modified = { phase: 'results', currentIndex: 9, section1Answers: ['A','A','A','A'], section2Answers: [], direction: 'forward' }
      const state = quizReducer(modified, { type: 'RESTART' })
      expect(state).toEqual(initialState)
    })
  })
})
