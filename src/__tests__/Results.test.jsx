import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Results from '../phases/Results'

const mockDispatch = vi.fn()

vi.mock('../context/QuizContext', () => ({
  useQuiz: () => ({
    state: {
      name: 'Alex',
      testScores: { gpa: '3.8', sat: '1450', ielts: '7.0' },
      extracurriculars: [{ description: 'Debate team captain' }],
      honors: [{ title: 'National Science Olympiad', level: 'National', participants: '5000' }],
      essay: 'I want to study the intersection of...',
      efc: 25000,
    },
    dispatch: mockDispatch,
  }),
}))

const MOCK_SCHOOLS = [
  {
    id: 'brown',
    name: 'Brown University',
    fitScore: 88,
    narrative: 'Brown\'s open curriculum suits your self-directed approach.',
    matchReasons: ['Open curriculum', 'Strong debate community'],
    concerns: ['Highly selective'],
  },
  {
    id: 'dartmouth',
    name: 'Dartmouth College',
    fitScore: 82,
    narrative: 'Dartmouth\'s collaborative culture matches your extracurriculars.',
    matchReasons: ['Strong liberal arts'],
    concerns: ['Rural location'],
  },
]

describe('Results', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows loading state initially', () => {
    fetch.mockReturnValue(new Promise(() => {}))  // never resolves
    render(<Results />)
    expect(screen.getByText('lowkey asking our AI bestie rn 🔮')).toBeInTheDocument()
  })

  it('renders school cards after successful fetch', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ schools: MOCK_SCHOOLS }),
    })
    render(<Results />)
    await waitFor(() => expect(screen.getByText('Brown University')).toBeInTheDocument())
    expect(screen.getByText('Dartmouth College')).toBeInTheDocument()
    expect(screen.getByText('2 schools for Alex')).toBeInTheDocument()
  })

  it('shows fit scores for each school', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ schools: MOCK_SCHOOLS }),
    })
    render(<Results />)
    await waitFor(() => expect(screen.getByText('88')).toBeInTheDocument())
    expect(screen.getByText('82')).toBeInTheDocument()
  })

  it('shows no-matches message when schools array is empty', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ schools: [] }),
    })
    render(<Results />)
    await waitFor(() => expect(screen.getByText('No financial matches found')).toBeInTheDocument())
  })

  it('shows error message on fetch failure', async () => {
    fetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'OpenRouter 500: internal error' }),
    })
    render(<Results />)
    await waitFor(() => expect(screen.getByText('Something went wrong')).toBeInTheDocument())
  })

  it('renders start over button', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ schools: MOCK_SCHOOLS }),
    })
    render(<Results />)
    expect(screen.getByText('↺ Start Over')).toBeInTheDocument()
  })
})
