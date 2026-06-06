import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import QuestionSlide from '../components/QuestionSlide'

const question = {
  id: 'q1',
  text: 'What type of school did you attend?',
  options: [
    { letter: 'A', text: 'International curricula' },
    { letter: 'B', text: 'Local school' },
    { letter: 'C', text: 'Specialized school' },
    { letter: 'D', text: 'Standard school' },
  ],
}

const baseProps = {
  question,
  selectedLetter: null,
  onSelect: () => {},
  onNext: () => {},
  onBack: () => {},
  showBack: false,
  direction: 'forward',
  sectionLabel: 'Section 1',
  counter: '1 / 14',
}

const renderSlide = (props = {}) => render(<QuestionSlide {...baseProps} {...props} />)

describe('QuestionSlide', () => {
  it('renders question text', () => {
    renderSlide({ showBack: true })
    expect(screen.getByText('What type of school did you attend?')).toBeInTheDocument()
  })

  it('renders all 4 options', () => {
    renderSlide()
    expect(screen.getByText('International curricula')).toBeInTheDocument()
    expect(screen.getByText('Standard school')).toBeInTheDocument()
  })

  it('calls onSelect with letter when option clicked', () => {
    const onSelect = vi.fn()
    renderSlide({ onSelect })
    fireEvent.click(screen.getByText('Local school'))
    expect(onSelect).toHaveBeenCalledWith('B')
  })

  it('auto-advances after selecting on a non-final question', () => {
    vi.useFakeTimers()
    const onNext = vi.fn()
    renderSlide({ onNext })
    fireEvent.click(screen.getByText('Local school'))
    expect(onNext).not.toHaveBeenCalled()
    vi.advanceTimersByTime(750)
    expect(onNext).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it('does not auto-advance on the final question', () => {
    vi.useFakeTimers()
    const onNext = vi.fn()
    renderSlide({ onNext, isFinal: true })
    fireEvent.click(screen.getByText('Local school'))
    vi.advanceTimersByTime(600)
    expect(onNext).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('shows the results button only on the final question', () => {
    const { rerender } = renderSlide()
    expect(screen.queryByText('See your results →')).not.toBeInTheDocument()
    rerender(<QuestionSlide {...baseProps} isFinal />)
    expect(screen.getByText('See your results →')).toBeInTheDocument()
  })

  it('results button is inactive until an option is selected', () => {
    renderSlide({ isFinal: true })
    expect(screen.getByText('See your results →')).not.toHaveClass('active')
  })

  it('results button is active when an option is selected', () => {
    renderSlide({ isFinal: true, selectedLetter: 'A' })
    expect(screen.getByText('See your results →')).toHaveClass('active')
  })

  it('hides Back button when showBack is false', () => {
    renderSlide()
    expect(screen.queryByText('← Back')).not.toBeInTheDocument()
  })
})
