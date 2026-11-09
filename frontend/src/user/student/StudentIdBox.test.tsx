import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { StudentIdBox } from './StudentIdBox'
import { StudentProvider } from './StudentProvider'

const STORAGE_KEY = 'school-admission.student-id'
const VALID_ID = '20152691234567890'
const HINT = /আবেদন করতে বা নিজের আবেদন দেখতে/

function renderBox() {
  return render(
    <StudentProvider>
      <StudentIdBox />
    </StudentProvider>,
  )
}

function box() {
  return screen.getByRole('textbox')
}

function removeButton() {
  return screen.queryByRole('button', { name: 'মুছুন' })
}

describe('StudentIdBox', () => {
  it('explains what to enter when it is empty', () => {
    renderBox()

    expect(screen.getByText(HINT)).toBeInTheDocument()
  })

  it('counts the digits without showing an error while the number is still being typed', async () => {
    renderBox()

    await userEvent.type(box(), '12345')

    expect(screen.getByText(/১৭ অঙ্কের হতে হবে/)).toBeInTheDocument()
    expect(box()).toHaveAttribute('aria-invalid', 'false')
  })

  it('shows an error once the person leaves the box with an unfinished number', async () => {
    renderBox()

    await userEvent.type(box(), '12345')
    await userEvent.tab()

    expect(box()).toHaveAttribute('aria-invalid', 'true')
  })

  it('shows an error straight away for something that can never be valid', async () => {
    renderBox()

    await userEvent.type(box(), '2015a')

    expect(screen.getByText(/শুধু অঙ্ক/)).toBeInTheDocument()
    expect(box()).toHaveAttribute('aria-invalid', 'true')
  })

  it('shows an error straight away for too many digits', async () => {
    renderBox()

    await userEvent.type(box(), '123456789012345678')

    expect(box()).toHaveAttribute('aria-invalid', 'true')
  })

  it('does not remember an unfinished number', async () => {
    renderBox()

    await userEvent.type(box(), '12345')

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('remembers a valid ID as plain digits, even if typed in Bangla', async () => {
    renderBox()

    await userEvent.type(box(), '২০১৫২৬৯১২৩৪৫৬৭৮৯০')

    expect(localStorage.getItem(STORAGE_KEY)).toBe(VALID_ID)
  })

  it('keeps the box on screen and in focus, and drops the hint, once the number is complete', async () => {
    renderBox()

    await userEvent.type(box(), VALID_ID)

    expect(box()).toHaveValue(VALID_ID)
    expect(box()).toHaveFocus()
    expect(box()).toHaveAttribute('aria-invalid', 'false')
    expect(screen.queryByText(HINT)).toBeNull()
  })

  it('brings back the remembered ID in the box when the page opens again, without taking focus', () => {
    localStorage.setItem(STORAGE_KEY, VALID_ID)

    renderBox()

    expect(box()).toHaveValue(VALID_ID)
    expect(box()).not.toHaveFocus()
  })

  it('lets the number be changed directly in the box', async () => {
    localStorage.setItem(STORAGE_KEY, VALID_ID)
    renderBox()

    await userEvent.clear(box())
    await userEvent.type(box(), '20152691234567891')

    expect(box()).toHaveValue('20152691234567891')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('20152691234567891')
  })

  it('removes the number on request, for shared computers', async () => {
    localStorage.setItem(STORAGE_KEY, VALID_ID)
    renderBox()

    await userEvent.click(removeButton()!)

    expect(box()).toHaveValue('')
    expect(box()).toHaveFocus()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('offers the remove button only when there is something to remove', async () => {
    renderBox()
    expect(removeButton()).toBeNull()

    await userEvent.type(box(), '1')

    expect(removeButton()).not.toBeNull()
  })
})
