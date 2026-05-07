import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Option from '../components/Option'

describe('Option', () => {
  it('renders letter and text', () => {
    render(<Option letter="A" text="Some option text" selected={false} dimmed={false} onClick={() => {}} />)
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('Some option text')).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    render(<Option letter="B" text="Click me" selected={false} dimmed={false} onClick={onClick} />)
    fireEvent.click(screen.getByText('Click me'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('applies selected class when selected', () => {
    const { container } = render(<Option letter="C" text="Selected" selected={true} dimmed={false} onClick={() => {}} />)
    expect(container.firstChild).toHaveClass('selected')
  })

  it('applies dimmed class when dimmed', () => {
    const { container } = render(<Option letter="D" text="Dimmed" selected={false} dimmed={true} onClick={() => {}} />)
    expect(container.firstChild).toHaveClass('dimmed')
  })
})
