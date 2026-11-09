import { describe, expect, it } from 'vitest'
import { describeStudentIdProblem, isValidStudentId, normalizeStudentId } from './studentId'

describe('normalizeStudentId', () => {
  it('converts Bangla digits so the value is safe to send in a header', () => {
    expect(normalizeStudentId('২০১৫২৬৯১২৩৪৫৬৭৮৯০')).toBe('20152691234567890')
  })

  it('removes spaces and dashes', () => {
    expect(normalizeStudentId(' 2015-2691 2345 67890 ')).toBe('20152691234567890')
  })
})

describe('isValidStudentId', () => {
  it.each([
    ['20152691234567890', true],
    ['2015269123456789', false],
    ['201526912345678901', false],
    ['2015269123456789a', false],
    ['', false],
  ])('%s is %s', (id, expected) => {
    expect(isValidStudentId(id)).toBe(expected)
  })
})

describe('describeStudentIdProblem', () => {
  it('says nothing while the box is empty or the ID is valid', () => {
    expect(describeStudentIdProblem('')).toBeNull()
    expect(describeStudentIdProblem('20152691234567890')).toBeNull()
  })

  it('says how many digits were typed', () => {
    expect(describeStudentIdProblem('12345')).toContain('৫ অঙ্ক')
  })

  it('explains when something other than digits was typed', () => {
    expect(describeStudentIdProblem('2015abc')).toContain('শুধু অঙ্ক')
  })
})
