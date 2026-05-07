import { describe, it, expect } from 'vitest'
import {
  calculateSection1Score,
  getAcademicTier,
  calculateFitType,
  getResult,
} from '../utils/scoring'

describe('calculateSection1Score', () => {
  it('scores all A answers as 16', () => {
    expect(calculateSection1Score(['A', 'A', 'A', 'A'])).toBe(16)
  })

  it('scores all D answers as 4', () => {
    expect(calculateSection1Score(['D', 'D', 'D', 'D'])).toBe(4)
  })

  it('Q3 B answer scores 4 (not 3)', () => {
    // Q3 index=2: B = 4 (special rule)
    expect(calculateSection1Score(['D', 'D', 'B', 'D'])).toBe(7)
  })

  it('Q4 C answer scores 3 (not 2)', () => {
    // Q4 index=3: C = 3 (special rule)
    expect(calculateSection1Score(['D', 'D', 'D', 'C'])).toBe(6)
  })

  it('scores mixed answers correctly', () => {
    // A=4, B=3, C=2(q3 C), B=3 → 4+3+2+3 = 12
    expect(calculateSection1Score(['A', 'B', 'C', 'B'])).toBe(12)
  })
})

describe('getAcademicTier', () => {
  it('returns t20 for 14-16', () => {
    expect(getAcademicTier(14)).toBe('t20')
    expect(getAcademicTier(16)).toBe('t20')
  })

  it('returns mid for 11-13', () => {
    expect(getAcademicTier(11)).toBe('mid')
    expect(getAcademicTier(13)).toBe('mid')
  })

  it('returns lower for 8-10', () => {
    expect(getAcademicTier(8)).toBe('lower')
    expect(getAcademicTier(10)).toBe('lower')
  })

  it('returns none for 4-7', () => {
    expect(getAcademicTier(4)).toBe('none')
    expect(getAcademicTier(7)).toBe('none')
  })
})

describe('calculateFitType', () => {
  it('returns dominant letter', () => {
    expect(calculateFitType(['A','A','A','B','B','B','B','C','D','D'])).toBe('B')
  })

  it('breaks ties by first alphabetical letter', () => {
    expect(calculateFitType(['A','A','B','B','C','C','D','D','A','B'])).toBe('A')
  })

  it('handles all same letter', () => {
    expect(calculateFitType(['C','C','C','C','C','C','C','C','C','C'])).toBe('C')
  })
})

describe('getResult', () => {
  it('returns correct label and tier for t20 tech profile', () => {
    const s1 = ['A', 'A', 'A', 'A'] // score 16
    const s2 = ['A','A','A','A','A','A','A','A','A','A'] // all A
    const result = getResult(s1, s2)
    expect(result.fitLetter).toBe('A')
    expect(result.label).toBe('Tech & Engineering')
    expect(result.tier).toBe('t20')
    expect(result.noSchools).toBe(false)
    expect(result.schools.some(s => s.name === 'MIT')).toBe(true)
    expect(result.schools.every(s => !s.adjusted)).toBe(true)
  })

  it('appends adjusted schools for mid tier', () => {
    const s1 = ['A', 'B', 'C', 'B'] // score 12 → mid
    const s2 = ['A','A','A','A','A','A','A','A','A','A']
    const result = getResult(s1, s2)
    expect(result.tier).toBe('mid')
    expect(result.schools.some(s => s.adjusted)).toBe(true)
    expect(result.schools.some(s => s.name === 'NYUAD')).toBe(true)
  })

  it('returns noSchools true for none tier', () => {
    const s1 = ['D', 'D', 'D', 'D'] // score 4 → none
    const s2 = ['B','B','B','B','B','B','B','B','B','B']
    const result = getResult(s1, s2)
    expect(result.noSchools).toBe(true)
    expect(result.schools).toHaveLength(0)
  })
})
