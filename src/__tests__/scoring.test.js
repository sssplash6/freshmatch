import { describe, it, expect } from 'vitest'
import { calculateSection1Score, getAcademicTier, getResult } from '../utils/scoring'

describe('calculateSection1Score', () => {
  it('scores A as 4', () => {
    expect(calculateSection1Score(['A'])).toBe(4)
  })

  it('scores D as 1', () => {
    expect(calculateSection1Score(['D'])).toBe(1)
  })

  it('ignores indices beyond the scored questions', () => {
    expect(calculateSection1Score(['A', 'A', 'A', 'A'])).toBe(4)
  })
})

describe('getAcademicTier', () => {
  it('returns t20 for 4', () => {
    expect(getAcademicTier(4)).toBe('t20')
  })

  it('returns mid for 3', () => {
    expect(getAcademicTier(3)).toBe('mid')
  })

  it('returns lower for 2', () => {
    expect(getAcademicTier(2)).toBe('lower')
  })

  it('returns none for 1', () => {
    expect(getAcademicTier(1)).toBe('none')
  })
})

describe('getResult', () => {
  it('returns t20 tier for A answer', () => {
    expect(getResult(['A']).tier).toBe('t20')
  })

  it('returns none tier for D answer', () => {
    expect(getResult(['D']).tier).toBe('none')
  })
})
