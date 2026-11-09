import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listClasses, type ClassSeats } from './api/admission'
import App from './App'

vi.mock('./api/admission')

const STUDENT_ID_LABEL = 'শিক্ষার্থীর জন্ম নিবন্ধন নম্বর'
const CLASS_NAME_LABEL = 'Class-এর নাম'
const APPLY = 'আবেদন করুন'

const A_CLASS: ClassSeats = {
  id: 'c1',
  name: 'Class 6 - Morning Shift',
  totalSeats: 120,
  heldSeats: 15,
  confirmedSeats: 80,
  availableSeats: 25,
}

function renderAt(route: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(listClasses).mockResolvedValue([A_CLASS])
})

afterEach(() => {
  vi.resetAllMocks()
})

describe('the two panels', () => {
  it('shows the user panel at the main address, with no way to create a class', async () => {
    renderAt('/')

    expect(await screen.findByRole('button', { name: APPLY })).toBeInTheDocument()
    expect(screen.getByLabelText(STUDENT_ID_LABEL)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'আমার আবেদন' })).toBeInTheDocument()
    expect(screen.queryByLabelText(CLASS_NAME_LABEL)).not.toBeInTheDocument()
  })

  it('shows the admin panel at /admin, with no student tools', async () => {
    renderAt('/admin')

    expect(await screen.findByText('Class 6 - Morning Shift')).toBeInTheDocument()
    expect(screen.getByLabelText(CLASS_NAME_LABEL)).toBeInTheDocument()
    expect(screen.queryByLabelText(STUDENT_ID_LABEL)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: APPLY })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'আমার আবেদন' })).not.toBeInTheDocument()
  })

  it('does not show guardians a link to the admin panel', async () => {
    const { container } = renderAt('/')
    await screen.findByRole('button', { name: APPLY })

    expect(container.querySelector('a[href^="/admin"]')).toBeNull()
  })

  it('explains when an address does not exist', () => {
    renderAt('/nothing-here')

    expect(screen.getByText('এই পেজটি পাওয়া যায়নি')).toBeInTheDocument()
  })
})
