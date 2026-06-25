import { describe, it, expect } from 'vitest'
import {
  hasSubstance,
  isValidHonorTitle,
  isSubstantiveEc,
  isValidSchoolName,
  isRealEssay,
  isValidSat,
  isValidIelts,
  isValidGpa,
} from '../utils/validation'

describe('hasSubstance', () => {
  it('rejects junk and short/repeated input', () => {
    expect(hasSubstance('', 3)).toBe(false)
    expect(hasSubstance('H', 3)).toBe(false)
    expect(hasSubstance('Jjj', 3)).toBe(false)   // single repeated char
    expect(hasSubstance('aaaa', 3)).toBe(false)
    expect(hasSubstance('Dd', 3)).toBe(false)     // too short
  })
  it('accepts real text', () => {
    expect(hasSubstance('AMC', 3)).toBe(true)
    expect(hasSubstance('Debate club', 3)).toBe(true)
  })
})

describe('field guards', () => {
  it('honor titles', () => {
    expect(isValidHonorTitle('Jjj')).toBe(false)
    expect(isValidHonorTitle('USACO Platinum')).toBe(true)
  })
  it('extracurriculars need real description', () => {
    expect(isSubstantiveEc('H')).toBe(false)
    expect(isSubstantiveEc('Chess')).toBe(false)              // under 12 chars
    expect(isSubstantiveEc('Captain of the debate team')).toBe(true)
  })
  it('school names', () => {
    expect(isValidSchoolName('Dd')).toBe(false)
    expect(isValidSchoolName('Lyceum 5')).toBe(true)
  })
  it('essay must clear the real-essay threshold', () => {
    expect(isRealEssay('Jj')).toBe(false)
    expect(isRealEssay('x'.repeat(80))).toBe(true)
  })
})

describe('numeric score bounds', () => {
  it('SAT', () => {
    expect(isValidSat('1500')).toBe(true)
    expect(isValidSat('9999')).toBe(false)
    expect(isValidSat('100')).toBe(false)
    expect(isValidSat('N/A')).toBe(true)
    expect(isValidSat('na')).toBe(true)
    expect(isValidSat('abc')).toBe(false)
  })
  it('IELTS', () => {
    expect(isValidIelts('8.0')).toBe(true)
    expect(isValidIelts('50')).toBe(false)
    expect(isValidIelts('N/A')).toBe(true)
  })
  it('GPA respects the scale', () => {
    expect(isValidGpa('5', '5')).toBe(true)
    expect(isValidGpa('99', '4')).toBe(false)
    expect(isValidGpa('3.8', '4')).toBe(true)
    expect(isValidGpa('N/A', '4')).toBe(true)
  })
})
