import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ProgressBar from '../components/ProgressBar'

describe('ProgressBar', () => {
  it('renders fill at given percent', () => {
    const { getByTestId } = render(<ProgressBar percent={50} />)
    const fill = getByTestId('progress-fill')
    expect(fill).toHaveStyle({ width: '50%' })
  })

  it('clamps to 100%', () => {
    const { getByTestId } = render(<ProgressBar percent={100} />)
    expect(getByTestId('progress-fill')).toHaveStyle({ width: '100%' })
  })
})
