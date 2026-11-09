import { describe, expect, it } from 'vitest'
import { validateClassForm } from './classForm'

describe('validateClassForm', () => {
  it('accepts a valid class and trims the name', () => {
    expect(validateClassForm('  Class 6 - Morning Shift ', '120')).toEqual({
      valid: true,
      newClass: { name: 'Class 6 - Morning Shift', totalSeats: 120 },
    })
  })

  it('accepts a seat count typed in Bangla digits', () => {
    expect(validateClassForm('Class 7', '১২০')).toEqual({
      valid: true,
      newClass: { name: 'Class 7', totalSeats: 120 },
    })
  })

  it.each(['0', '-5', '1.5', 'abc', '99999999999'])('rejects %s seats', (seats) => {
    const result = validateClassForm('Class 7', seats)
    expect(result.valid).toBe(false)
  })

  it('reports both fields when both are empty', () => {
    const result = validateClassForm('   ', '')
    expect(result).toMatchObject({
      valid: false,
      problems: { name: expect.any(String), totalSeats: expect.any(String) },
    })
  })
})
