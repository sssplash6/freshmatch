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

describe('QuestionSlide', () => {
  it('renders question text', () => {
    render(
      <QuestionSlide
        question={question}
        selectedLetter={null}
        onSelect={() => {}}
        onNext={() => {}}
        onBack={() => {}}
        showBack={true}
        direction="forward"
        sectionLabel="Section 1"
        counter="1 / 4"
      />
    )
    expect(screen.getByText('What type of school did you attend?')).toBeInTheDocument()
  })

  it('renders all 4 options', () => {
    render(
      <QuestionSlide
        question={question}
        selectedLetter={null}
        onSelect={() => {}}
        onNext={() => {}}
        onBack={() => {}}
        showBack={false}
        direction="forward"
        sectionLabel="Section 1"
        counter="1 / 4"
      />
    )
    expect(screen.getByText('International curricula')).toBeInTheDocument()
    expect(screen.getByText('Standard school')).toBeInTheDocument()
  })

  it('calls onSelect with letter when option clicked', () => {
    const onSelect = vi.fn()
    render(
      <QuestionSlide
        question={question}
        selectedLetter={null}
        onSelect={onSelect}
        onNext={() => {}}
        onBack={() => {}}
        showBack={false}
        direction="forward"
        sectionLabel="Section 1"
        counter="1 / 4"
      />
    )
    fireEvent.click(screen.getByText('Local school'))
    expect(onSelect).toHaveBeenCalledWith('B')
  })

  it('Continue button is disabled when no option selected', () => {
    render(
      <QuestionSlide
        question={question}
        selectedLetter={null}
        onSelect={() => {}}
        onNext={() => {}}
        onBack={() => {}}
        showBack={false}
        direction="forward"
        sectionLabel="Section 1"
        counter="1 / 4"
      />
    )
    expect(screen.getByText('Continue →')).not.toHaveClass('active')
  })

  it('Continue button is active when option is selected', () => {
    render(
      <QuestionSlide
        question={question}
        selectedLetter="A"
        onSelect={() => {}}
        onNext={() => {}}
        onBack={() => {}}
        showBack={false}
        direction="forward"
        sectionLabel="Section 1"
        counter="1 / 4"
      />
    )
    expect(screen.getByText('Continue →')).toHaveClass('active')
  })

  it('hides Back button when showBack is false', () => {
    render(
      <QuestionSlide
        question={question}
        selectedLetter={null}
        onSelect={() => {}}
        onNext={() => {}}
        onBack={() => {}}
        showBack={false}
        direction="forward"
        sectionLabel="Section 1"
        counter="1 / 4"
      />
    )
    expect(screen.queryByText('← Back')).not.toBeInTheDocument()
  })
})
