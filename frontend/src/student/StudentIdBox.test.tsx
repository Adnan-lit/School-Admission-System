import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { StudentIdBox } from './StudentIdBox'
import { StudentProvider } from './StudentProvider'

const STORAGE_KEY = 'school-admission.student-id'

function renderBox() {
  return render(
    <StudentProvider>
      <StudentIdBox />
    </StudentProvider>,
  )
}

describe('StudentIdBox', () => {
  it('explains a wrong ID and does not remember it', async () => {
    renderBox()

    await userEvent.type(screen.getByRole('textbox'), '12345')

    expect(screen.getByText(/১৭ অঙ্কের হতে হবে/)).toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('remembers a valid ID as plain digits, even if typed in Bangla', async () => {
    renderBox()

    await userEvent.type(screen.getByRole('textbox'), '২০১৫২৬৯১২৩৪৫৬৭৮৯০')

    expect(localStorage.getItem(STORAGE_KEY)).toBe('20152691234567890')
  })

  it('brings back the remembered ID when the page opens again', () => {
    localStorage.setItem(STORAGE_KEY, '20152691234567890')

    renderBox()

    expect(screen.getByRole('textbox')).toHaveValue('20152691234567890')
  })
})
