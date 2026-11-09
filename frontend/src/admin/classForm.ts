import type { NewClass } from '../api/admission'
import { toAsciiDigits } from '../utils/digits'

const MAX_NAME_LENGTH = 200
const MAX_SEATS = 2_147_483_647

export interface ClassFormProblems {
  name?: string
  totalSeats?: string
}

export type ClassFormResult =
  | { valid: true; newClass: NewClass }
  | { valid: false; problems: ClassFormProblems }

export function validateClassForm(name: string, totalSeats: string): ClassFormResult {
  const problems: ClassFormProblems = {}

  const trimmedName = name.trim()
  if (trimmedName === '') {
    problems.name = 'Class-এর নাম লিখুন।'
  } else if (trimmedName.length > MAX_NAME_LENGTH) {
    problems.name = 'Class-এর নাম ২০০ অক্ষরের মধ্যে রাখুন।'
  }

  const seatsText = toAsciiDigits(totalSeats.trim())
  const seats = Number(seatsText)
  if (seatsText === '') {
    problems.totalSeats = 'Seat সংখ্যা লিখুন।'
  } else if (!/^[0-9]+$/.test(seatsText) || seats < 1 || seats > MAX_SEATS) {
    problems.totalSeats = 'Seat সংখ্যা ১ বা তার বেশি একটি পূর্ণ সংখ্যা হতে হবে।'
  }

  if (problems.name || problems.totalSeats) {
    return { valid: false, problems }
  }

  return { valid: true, newClass: { name: trimmedName, totalSeats: seats } }
}
