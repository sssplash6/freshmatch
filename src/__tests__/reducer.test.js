import { describe, it, expect } from 'vitest'

import { quizReducer, initialState } from '../context/QuizContext'

const section1State = { ...initialState, phase: 'section1' }

describe('quizReducer', () => {
  describe('START', () => {
    it('moves from landing into intake', () => {
      expect(initialState.phase).toBe('landing')
      const state = quizReducer(initialState, { type: 'START' })
      expect(state.phase).toBe('intake')
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
  })

  describe('NEXT', () => {
    it('advances currentIndex within section1', () => {
      const state = quizReducer(section1State, { type: 'NEXT' })
      expect(state.currentIndex).toBe(1)
      expect(state.phase).toBe('section1')
      expect(state.direction).toBe('forward')
    })

    it('transitions to results after last section1 question', () => {
      const s = { ...section1State, currentIndex: 4 }
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
  })

  describe('RESTART', () => {
    it('resets to initial state', () => {
      const modified = { ...initialState, phase: 'results', currentIndex: 4, section1Answers: ['A','A','A','A','A'] }
      const state = quizReducer(modified, { type: 'RESTART' })
      expect(state.phase).toBe('landing')
      expect(state.currentIndex).toBe(0)
      expect(state.section1Answers).toEqual([])
    })
  })
})
