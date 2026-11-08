import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { vi } from 'vitest'
import { StudentContext } from '../student/StudentContext'

export const TEST_STUDENT_ID = '20152691234567890'

interface RenderOptions {
  path?: string
  route?: string
  studentId?: string | null
}

/** Renders a page with everything it needs. Navigating elsewhere shows "other page". */
export function renderPage(page: ReactNode, options: RenderOptions = {}) {
  const { path = '/', route = '/', studentId = TEST_STUDENT_ID } = options
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <StudentContext value={{ input: studentId ?? '', studentId, setInput: vi.fn() }}>
          <Routes>
            <Route path={path} element={page} />
            <Route path="*" element={<div>other page</div>} />
          </Routes>
        </StudentContext>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
