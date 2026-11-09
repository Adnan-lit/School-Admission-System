import { act, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listMyHolds, type Hold, type HoldStatus } from '../api/admission'
import { renderPage } from '../test/renderPage'
import { ActiveApplicationBanner } from './ActiveApplicationBanner'

vi.mock('../api/admission')

function hold(holdId: string, className: string, secondsLeft: number, status: HoldStatus = 'HELD'): () => Hold {
  const expiresAt = new Date(Date.now() + secondsLeft * 1000).toISOString()
  return () => ({
    holdId,
    classId: `class-${holdId}`,
    className,
    status,
    expiresAt,
    serverTime: new Date().toISOString(),
  })
}

function serverHas(...holds: (() => Hold)[]) {
  vi.mocked(listMyHolds).mockImplementation(() => Promise.resolve(holds.map((make) => make())))
}

function advanceSeconds(seconds: number) {
  return act(() => vi.advanceTimersByTimeAsync(seconds * 1000))
}

function payLink() {
  return screen.queryByRole('link', { name: 'ফি দিন' })
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
  vi.resetAllMocks()
})

describe('ActiveApplicationBanner', () => {
  it('shows the class, the time left and a way to pay', async () => {
    serverHas(hold('h1', 'Class 6 - Morning Shift', 90.5))
    renderPage(<ActiveApplicationBanner />)

    expect(await screen.findByRole('link', { name: 'ফি দিন' })).toHaveAttribute('href', '/holds/h1')
    expect(screen.getByText(/Class 6 - Morning Shift/)).toBeInTheDocument()
    expect(screen.getByText(/^01:\d\d$/)).toBeInTheDocument()
  })

  it('shows nothing when no application is running', async () => {
    serverHas(hold('h1', 'Class 6', 90, 'CONFIRMED'), hold('h2', 'Class 7', 90, 'CANCELLED'))
    const { container } = renderPage(<ActiveApplicationBanner />)

    await advanceSeconds(1)

    expect(container).toBeEmptyDOMElement()
  })

  it('shows nothing without a student', async () => {
    const { container } = renderPage(<ActiveApplicationBanner />, { studentId: null })

    await advanceSeconds(1)

    expect(container).toBeEmptyDOMElement()
    expect(listMyHolds).not.toHaveBeenCalled()
  })

  it('points to the application closest to running out, and counts the others', async () => {
    serverHas(hold('later', 'Class 7', 500), hold('sooner', 'Class 6', 100))
    renderPage(<ActiveApplicationBanner />)

    expect(await screen.findByRole('link', { name: 'ফি দিন' })).toHaveAttribute('href', '/holds/sooner')
    expect(screen.getByText(/আরও ১টি আবেদন চলছে/)).toBeInTheDocument()
  })

  it('does not repeat the application already on screen', async () => {
    serverHas(hold('h1', 'Class 6', 90))
    const { container } = renderPage(<ActiveApplicationBanner />, { path: '/holds/:holdId', route: '/holds/h1' })

    await advanceSeconds(1)

    expect(container).toBeEmptyDOMElement()
  })

  it('still mentions a different running application from an application page', async () => {
    serverHas(hold('h1', 'Class 6', 90), hold('h2', 'Class 7', 200))
    renderPage(<ActiveApplicationBanner />, { path: '/holds/:holdId', route: '/holds/h1' })

    expect(await screen.findByRole('link', { name: 'ফি দিন' })).toHaveAttribute('href', '/holds/h2')
  })

  it('turns urgent near the end and disappears when time runs out, with no reload', async () => {
    serverHas(hold('h1', 'Class 6', 20))
    const { container } = renderPage(<ActiveApplicationBanner />)
    await screen.findByRole('link', { name: 'ফি দিন' })
    expect(container.querySelector('.running-banner-warning')).not.toBeNull()

    await advanceSeconds(10)
    expect(container.querySelector('.running-banner-urgent')).not.toBeNull()

    await advanceSeconds(11)
    expect(payLink()).toBeNull()
  })
})
