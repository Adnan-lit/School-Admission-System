import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cancelHold, confirmHold, getHold, type Hold, type HoldStatus } from '../api/admission'
import { ApiError } from '../api/errors'
import { renderPage, TEST_STUDENT_ID } from '../test/renderPage'
import { ApplicationPage } from './ApplicationPage'

vi.mock('../api/admission')

const PAY = 'ভর্তি ফি দিন'
const CANCEL = 'বাতিল'

/** Makes getHold behave like the real server, whose clock keeps moving. */
function serverHas(status: HoldStatus, secondsFromNow = 60) {
  const expiresAt = new Date(Date.now() + secondsFromNow * 1000).toISOString()
  vi.mocked(getHold).mockImplementation(
    (): Promise<Hold> =>
      Promise.resolve({
        holdId: 'h1',
        classId: 'c1',
        className: 'Class 6 - Morning Shift',
        status,
        expiresAt,
        serverTime: new Date().toISOString(),
      }),
  )
}

function renderApplication(studentId: string | null = TEST_STUDENT_ID) {
  return renderPage(<ApplicationPage />, { path: '/holds/:holdId', route: '/holds/h1', studentId })
}

function button(name: string) {
  return screen.getByRole('button', { name })
}

function advanceSeconds(seconds: number) {
  return act(() => vi.advanceTimersByTimeAsync(seconds * 1000))
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
  vi.resetAllMocks()
})

describe('ApplicationPage', () => {
  it('counts down by itself', async () => {
    serverHas('HELD', 30.5)
    renderApplication()

    expect(await screen.findByRole('timer')).toHaveTextContent('00:30')

    await advanceSeconds(10)

    expect(screen.getByRole('timer')).toHaveTextContent('00:20')
  })

  it('shows EXPIRED and disables paying when time runs out, with no reload', async () => {
    serverHas('HELD', 2)
    renderApplication()

    await screen.findByRole('timer')
    expect(button(PAY)).toBeEnabled()

    await advanceSeconds(3)

    expect(screen.getByText('EXPIRED')).toBeInTheDocument()
    expect(button(PAY)).toBeDisabled()
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
  })

  it('makes the countdown more urgent as time runs out', async () => {
    serverHas('HELD', 75)
    const { container } = renderApplication()
    await screen.findByRole('timer')
    expect(container.querySelector('.countdown-normal')).not.toBeNull()

    await advanceSeconds(20)
    expect(container.querySelector('.countdown-warning')).not.toBeNull()
    expect(screen.getByText(/সময় প্রায় শেষ/)).toBeInTheDocument()

    await advanceSeconds(45)
    expect(container.querySelector('.countdown-urgent')).not.toBeNull()
  })

  it('shows the time left in the browser tab, and stops when the application ends', async () => {
    serverHas('HELD', 30.5)
    renderApplication()
    await screen.findByRole('timer')
    expect(document.title).toMatch(/00:\d\d বাকি/)

    await advanceSeconds(32)

    expect(screen.getByText('EXPIRED')).toBeInTheDocument()
    expect(document.title).not.toContain('বাকি')
  })

  it('pays with the current student and shows the admission as confirmed', async () => {
    serverHas('HELD')
    vi.mocked(confirmHold).mockImplementation(() => {
      serverHas('CONFIRMED')
      return Promise.resolve()
    })
    renderApplication()
    await screen.findByRole('timer')

    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(button(PAY))

    expect(await screen.findByText('CONFIRMED')).toBeInTheDocument()
    expect(confirmHold).toHaveBeenCalledWith('h1', TEST_STUDENT_ID)
    expect(button(PAY)).toBeDisabled()
    expect(button(CANCEL)).toBeDisabled()
  })

  it('cancels and shows the application as cancelled', async () => {
    serverHas('HELD')
    vi.mocked(cancelHold).mockImplementation(() => {
      serverHas('CANCELLED')
      return Promise.resolve()
    })
    renderApplication()
    await screen.findByRole('timer')

    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(button(CANCEL))

    expect(await screen.findByText('CANCELLED')).toBeInTheDocument()
    expect(cancelHold).toHaveBeenCalledWith('h1', TEST_STUDENT_ID)
  })

  it('explains when paying fails', async () => {
    serverHas('HELD')
    vi.mocked(confirmHold).mockRejectedValue(new ApiError('NOT_YOUR_HOLD', 403))
    renderApplication()
    await screen.findByRole('timer')

    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(button(PAY))

    expect(await screen.findByRole('alert')).toHaveTextContent('অন্য শিক্ষার্থীর')
    expect(screen.getByText('HELD')).toBeInTheDocument()
  })

  it('needs a student ID before paying or cancelling', async () => {
    serverHas('HELD')
    renderApplication(null)

    await screen.findByRole('timer')

    expect(button(PAY)).toBeDisabled()
    expect(button(CANCEL)).toBeDisabled()
    expect(screen.getByText(/জন্ম নিবন্ধন নম্বর লিখুন/)).toBeInTheDocument()
  })

  it('explains when the application does not exist', async () => {
    vi.mocked(getHold).mockRejectedValue(new ApiError('HOLD_NOT_FOUND', 404))
    renderApplication()

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('খুঁজে পাওয়া যায়নি'))
  })
})
