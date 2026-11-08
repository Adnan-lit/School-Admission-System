const BANGLA_ZERO = '০'.charCodeAt(0)
const STUDENT_ID_LENGTH = 17

/**
 * Converts Bangla digits to 0-9 and removes spaces and dashes.
 * This matters beyond tidiness: fetch throws an error if a header contains Bangla characters.
 */
export function normalizeStudentId(input: string): string {
  return input
    .replace(/[\s-]/g, '')
    .replace(/[০-৯]/g, (digit) => String(digit.charCodeAt(0) - BANGLA_ZERO))
}

export function isValidStudentId(normalizedId: string): boolean {
  return /^[0-9]{17}$/.test(normalizedId)
}

/** Explains what is wrong with the ID, or returns null if it is valid or still empty. */
export function describeStudentIdProblem(normalizedId: string): string | null {
  if (normalizedId === '' || isValidStudentId(normalizedId)) {
    return null
  }

  if (!/^[0-9]+$/.test(normalizedId)) {
    return 'জন্ম নিবন্ধন নম্বরে শুধু অঙ্ক থাকতে পারে।'
  }

  const count = normalizedId.length.toLocaleString('bn-BD')
  const required = STUDENT_ID_LENGTH.toLocaleString('bn-BD')
  return `জন্ম নিবন্ধন নম্বর ${required} অঙ্কের হতে হবে। এখন ${count} অঙ্ক আছে।`
}
