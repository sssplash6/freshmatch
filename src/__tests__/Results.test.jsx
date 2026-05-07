import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Results from '../phases/Results'

vi.mock('../context/QuizContext', () => ({
  useQuiz: () => ({
    state: {
      section1Answers: ['A', 'A', 'A', 'A'], // score 16 → t20
      section2Answers: ['C','C','C','C','C','C','C','C','C','C'], // fit C
    },
    dispatch: vi.fn(),
  }),
}))

describe('Results', () => {
  it('renders fit label', () => {
    render(<Results />)
    expect(screen.getByText('Free-Spirit Intellectual')).toBeInTheDocument()
  })

  it('renders base schools', () => {
    render(<Results />)
    expect(screen.getByText('University of Chicago')).toBeInTheDocument()
    expect(screen.getByText('Brown University')).toBeInTheDocument()
  })

  it('renders start over button', () => {
    render(<Results />)
    expect(screen.getByText('↺ Start Over')).toBeInTheDocument()
  })
})
