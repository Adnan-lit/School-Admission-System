import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyForSeat, listClasses, listMyHolds, type ClassSeats, type CreatedHold } from '../api/admission'
import { ApiError } from '../api/errors'
import { renderPage, TEST_STUDENT_ID } from '../test/renderPage'
import { ClassListPage } from './ClassListPage'

vi.mock('../api/admission')

const APPLY = 'আবেদন করুন'

function schoolClass(overrides: Partial<ClassSeats> = {}): ClassSeats {
  return {
    id: 'c1',
    name: 'Class 6 - Morning Shift',
    totalSeats: 120,
    heldSeats: 15,
    confirmedSeats: 80,
    availableSeats: 25,
    ...overrides,
  }
}

function rowCells() {
  return within(screen.getAllByRole('row')[1])
    .getAllByRole('cell')
    .map((cell) => cell.textContent)
}

function advanceSeconds(seconds: number) {
  return act(() => vi.advanceTimersByTimeAsync(seconds * 1000))
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.mocked(listMyHolds).mockResolvedValue([])
})

afterEach(() => {
  vi.useRealTimers()
  vi.resetAllMocks()
})

describe('ClassListPage', () => {
  it('shows total, held, confirmed and free seats', async () => {
    vi.mocked(listClasses).mockResolvedValue([schoolClass()])
    renderPage(<ClassListPage />)

    await screen.findByText('Class 6 - Morning Shift')

    expect(rowCells().slice(0, 4)).toEqual(['120', '15', '80', '25'])
  })

  it('updates the seat counts by itself, with no reload', async () => {
    vi.mocked(listClasses).mockResolvedValue([schoolClass()])
    renderPage(<ClassListPage />)
    await screen.findByText('Class 6 - Morning Shift')

    vi.mocked(listClasses).mockResolvedValue([schoolClass({ heldSeats: 16, availableSeats: 24 })])
    await advanceSeconds(4)

    expect(rowCells().slice(0, 4)).toEqual(['120', '16', '80', '24'])
  })

  it('keeps the last numbers on screen and explains when the server goes down', async () => {
    vi.mocked(listClasses).mockResolvedValue([schoolClass()])
    renderPage(<ClassListPage />)
    await screen.findByText('Class 6 - Morning Shift')

    vi.mocked(listClasses).mockRejectedValue(new ApiError('NETWORK_ERROR'))
    await advanceSeconds(4)

    expect(screen.getByRole('alert')).toHaveTextContent('সার্ভারের সাথে যোগাযোগ')
    expect(rowCells().slice(0, 4)).toEqual(['120', '15', '80', '25'])
  })

  it('needs a student ID before applying', async () => {
    vi.mocked(listClasses).mockResolvedValue([schoolClass()])
    renderPage(<ClassListPage />, { studentId: null })

    expect(await screen.findByRole('button', { name: APPLY })).toBeDisabled()
    expect(screen.getByText(/জন্ম নিবন্ধন নম্বর লিখুন/)).toBeInTheDocument()
  })

  it('points out when few seats are left, and not otherwise', async () => {
    vi.mocked(listClasses).mockResolvedValue([
      schoolClass({ id: 'c1', name: 'Plenty', availableSeats: 80 }),
      schoolClass({ id: 'c2', name: 'Nearly full', availableSeats: 3 }),
    ])
    const { container } = renderPage(<ClassListPage />)
    await screen.findByText('Nearly full')

    expect(screen.getByText('আর ৩টি')).toBeInTheDocument()
    expect(screen.getAllByText(/^আর /)).toHaveLength(1)
    expect(container.querySelector('.free-seats-few')).toHaveTextContent('3')
    expect(container.querySelector('.free-seats-plenty')).toHaveTextContent('80')
  })

  it('shows an active application as an action, in the same style as the buttons', async () => {
    vi.mocked(listClasses).mockResolvedValue([schoolClass()])
    vi.mocked(listMyHolds).mockResolvedValue([
      {
        holdId: 'h1',
        classId: 'c1',
        className: 'Class 6 - Morning Shift',
        status: 'HELD',
        expiresAt: '2030-01-01T00:00:00Z',
        serverTime: '2029-12-31T23:59:00Z',
      },
    ])
    renderPage(<ClassListPage />)

    const link = await screen.findByRole('link', { name: 'আবেদন দেখুন' })

    expect(link).toHaveAttribute('href', '/holds/h1')
    expect(link).toHaveClass('link-button')
  })

  it('shows when a class is full', async () => {
    vi.mocked(listClasses).mockResolvedValue([schoolClass({ availableSeats: 0 })])
    renderPage(<ClassListPage />)

    expect(await screen.findByRole('button', { name: 'Seat নেই' })).toBeDisabled()
    expect(screen.queryByText(/^আর /)).toBeNull()
  })

  it('applies with the current student and opens the application', async () => {
    const hold: CreatedHold = {
      holdId: 'h1',
      classId: 'c1',
      studentId: TEST_STUDENT_ID,
      status: 'HELD',
      expiresAt: '2026-11-11T10:00:00Z',
    }
    vi.mocked(listClasses).mockResolvedValue([schoolClass()])
    vi.mocked(applyForSeat).mockResolvedValue(hold)
    renderPage(<ClassListPage />)

    const button = await screen.findByRole('button', { name: APPLY })
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(button)

    expect(await screen.findByText('other page')).toBeInTheDocument()
    expect(applyForSeat).toHaveBeenCalledWith('c1', TEST_STUDENT_ID)
  })

  it('explains when the last seat has just gone', async () => {
    vi.mocked(listClasses).mockResolvedValue([schoolClass()])
    vi.mocked(applyForSeat).mockRejectedValue(new ApiError('NO_SEATS_AVAILABLE', 409))
    renderPage(<ClassListPage />)

    const button = await screen.findByRole('button', { name: APPLY })
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(button)

    expect(await screen.findByRole('alert')).toHaveTextContent('খালি seat নেই')
  })
})
