import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

function BrokenScreen(): never {
  throw new Error('render failure')
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ErrorBoundary', () => {
  it('shows a message and a reload button instead of a blank page', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <BrokenScreen />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('পেজটি দেখাতে সমস্যা হয়েছে')
    expect(screen.getByRole('button', { name: 'আবার লোড করুন' })).toBeInTheDocument()
  })

  it('shows the page normally when nothing goes wrong', () => {
    render(
      <ErrorBoundary>
        <p>normal page</p>
      </ErrorBoundary>,
    )

    expect(screen.getByText('normal page')).toBeInTheDocument()
  })
})
