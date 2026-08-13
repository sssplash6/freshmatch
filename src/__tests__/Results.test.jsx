import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Results, { ResultsView } from '../phases/Results'

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
    expect(screen.getByText('digging through admissions lore 📚')).toBeInTheDocument()
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

describe('per-college report CTA', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('offers the report in the expanded modal for the live quiz and posts the right college', async () => {
    const user = userEvent.setup()
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ schools: MOCK_SCHOOLS }),
    })
    render(<Results />)
    await waitFor(() => expect(screen.getByText('Brown University')).toBeInTheDocument())

    await user.click(screen.getByText('Brown University'))
    const cta = await screen.findByText('Get the full report (PDF)')

    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ reportId: 'abc', pdfUrl: '/api/report/abc.pdf' }),
    })
    await user.click(cta)

    const link = await screen.findByText('↗ Open your report (PDF)')
    expect(link).toHaveAttribute('href', '/api/report/abc.pdf')
    const body = JSON.parse(fetch.mock.calls.at(-1)[1].body)
    expect(fetch.mock.calls.at(-1)[0]).toBe('/api/report')
    expect(body.collegeId).toBe('brown')
    expect(body.fitScore).toBe(88)
    expect(body.efc).toBe(25000)
  })

  it('surfaces a report failure with a retry, without breaking the modal', async () => {
    const user = userEvent.setup()
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ schools: MOCK_SCHOOLS }),
    })
    render(<Results />)
    await waitFor(() => expect(screen.getByText('Brown University')).toBeInTheDocument())
    await user.click(screen.getByText('Brown University'))

    fetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Report limit reached. Please wait a while and try again.' }),
    })
    await user.click(await screen.findByText('Get the full report (PDF)'))
    expect(await screen.findByText('Report limit reached. Please wait a while and try again.')).toBeInTheDocument()
    expect(screen.getByText('Try again')).toBeInTheDocument()
  })

  it('never renders the report CTA on a shared results view (no profile to send)', async () => {
    const user = userEvent.setup()
    render(
      <ResultsView
        name="Alex"
        schools={MOCK_SCHOOLS}
        recommendation="admissions"
      />
    )
    // Shared pages pass no onGenerateReport — the opened modal shows no CTA.
    await user.click(screen.getByText('Brown University'))
    expect(await screen.findByText(/open curriculum suits/)).toBeInTheDocument()
    expect(screen.queryByText('Get the full report (PDF)')).not.toBeInTheDocument()
  })
})
