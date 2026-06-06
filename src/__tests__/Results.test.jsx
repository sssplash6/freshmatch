import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Results from '../phases/Results'

const mockState = {
  section1Answers: ['A', 'A', 'A', 'A'], // score 16 → t20
  section2Answers: ['C','C','C','C','C','C','C','C','C','C'], // fit C
}

vi.mock('../context/QuizContext', () => ({
  useQuiz: () => ({ state: mockState, dispatch: vi.fn() }),
}))

describe('Results', () => {
  it('renders fit label', () => {
    mockState.section1Answers = ['A', 'A', 'A', 'A']
    render(<Results />)
    expect(screen.getByText('Free-Spirit Intellectual')).toBeInTheDocument()
  })

  it('renders base schools under the Best Fit group', () => {
    mockState.section1Answers = ['A', 'A', 'A', 'A']
    render(<Results />)
    expect(screen.getByText('Best Fit')).toBeInTheDocument()
    expect(screen.getByText('University of Chicago')).toBeInTheDocument()
    expect(screen.getByText('Brown University')).toBeInTheDocument()
  })

  it('shows only the Best Fit group for a t20 profile', () => {
    mockState.section1Answers = ['A', 'A', 'A', 'A'] // t20 → no adjustment
    render(<Results />)
    expect(screen.getByText('Best Fit')).toBeInTheDocument()
    expect(screen.queryByText('Realistic For Your Profile')).not.toBeInTheDocument()
  })

  it('shows both groups with distinct captions for a mid-tier profile', () => {
    mockState.section1Answers = ['A', 'B', 'C', 'B'] // score 12 → mid
    render(<Results />)
    // Fit group: aspirational, profile-based
    expect(screen.getByText('Best Fit')).toBeInTheDocument()
    expect(screen.getByText(/Where you belong by temperament/)).toBeInTheDocument()
    // Adjusted group: realistic, academics-based
    expect(screen.getByText('Realistic For Your Profile')).toBeInTheDocument()
    expect(screen.getByText(/Realistic schools you'd fit based on your current academic profile/)).toBeInTheDocument()
    // Adjusted school renders as a plain name (no "adjusted" suffix)
    expect(screen.getByText('NYUAD')).toBeInTheDocument()
  })

  it('renders start over button', () => {
    mockState.section1Answers = ['A', 'A', 'A', 'A']
    render(<Results />)
    expect(screen.getByText('↺ Start Over')).toBeInTheDocument()
  })
})
