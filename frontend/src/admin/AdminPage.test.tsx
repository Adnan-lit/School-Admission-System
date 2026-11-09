import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createClass, listClasses, type ClassSeats } from '../api/admission'
import { ApiError } from '../api/errors'
import { renderPage } from '../test/renderPage'
import { AdminPage } from './AdminPage'

vi.mock('../api/admission')

const SUBMIT = 'Class তৈরি করুন'

function schoolClass(overrides: Partial<ClassSeats> = {}): ClassSeats {
  return {
    id: 'c1',
    name: 'Class 7 - Day Shift',
    totalSeats: 30,
    heldSeats: 0,
    confirmedSeats: 0,
    availableSeats: 30,
    ...overrides,
  }
}

function rowCells() {
  return within(screen.getAllByRole('row')[1])
    .getAllByRole('cell')
    .map((cell) => cell.textContent)
}

function user() {
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
}

async function fillAndSubmit(name: string, seats: string) {
  const person = user()
  await person.type(screen.getByLabelText('Class-এর নাম'), name)
  await person.type(screen.getByLabelText('মোট seat সংখ্যা'), seats)
  await person.click(screen.getByRole('button', { name: SUBMIT }))
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.mocked(listClasses).mockResolvedValue([])
})

afterEach(() => {
  vi.useRealTimers()
  vi.resetAllMocks()
})

describe('AdminPage', () => {
  it('creates a class and shows it in the overview straight away', async () => {
    vi.mocked(createClass).mockImplementation(() => {
      vi.mocked(listClasses).mockResolvedValue([schoolClass()])
      return Promise.resolve({ id: 'c1', name: 'Class 7 - Day Shift', totalSeats: 30 })
    })
    renderPage(<AdminPage />)
    await screen.findByText(/কোনো class তৈরি করা হয়নি/)

    await fillAndSubmit('  Class 7 - Day Shift  ', '30')

    expect(await screen.findByRole('status')).toHaveTextContent('তৈরি হয়েছে')
    expect(vi.mocked(createClass).mock.calls[0][0]).toEqual({ name: 'Class 7 - Day Shift', totalSeats: 30 })
    expect(await screen.findByRole('rowheader', { name: 'Class 7 - Day Shift' })).toBeInTheDocument()
    expect(screen.getByLabelText('Class-এর নাম')).toHaveValue('')
  })

  it('explains bad input and does not call the server', async () => {
    renderPage(<AdminPage />)
    await screen.findByText(/কোনো class তৈরি করা হয়নি/)

    await fillAndSubmit('Class 7', '0')

    expect(screen.getByText(/পূর্ণ সংখ্যা হতে হবে/)).toBeInTheDocument()
    expect(createClass).not.toHaveBeenCalled()
  })

  it('explains when the server refuses', async () => {
    vi.mocked(createClass).mockRejectedValue(new ApiError('INTERNAL_ERROR', 500))
    renderPage(<AdminPage />)
    await screen.findByText(/কোনো class তৈরি করা হয়নি/)

    await fillAndSubmit('Class 7', '30')

    expect(await screen.findByRole('alert')).toHaveTextContent('সার্ভারে একটি সমস্যা হয়েছে')
  })

  it('shows live seat counts and offers no way to apply', async () => {
    vi.mocked(listClasses).mockResolvedValue([schoolClass()])
    renderPage(<AdminPage />)
    await screen.findByRole('rowheader', { name: 'Class 7 - Day Shift' })
    expect(rowCells()).toEqual(['30', '0', '0', '30'])

    vi.mocked(listClasses).mockResolvedValue([schoolClass({ heldSeats: 2, confirmedSeats: 1, availableSeats: 27 })])
    await act(() => vi.advanceTimersByTimeAsync(4000))

    expect(rowCells()).toEqual(['30', '2', '1', '27'])
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })
})
