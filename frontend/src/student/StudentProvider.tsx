import { useMemo, useState, type ReactNode } from 'react'
import { StudentContext, type StudentState } from './StudentContext'
import { isValidStudentId, normalizeStudentId } from './studentId'

const STORAGE_KEY = 'school-admission.student-id'

function readSavedStudentId(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

function saveStudentId(studentId: string | null) {
  try {
    if (studentId) {
      localStorage.setItem(STORAGE_KEY, studentId)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // Storage can be blocked by the browser. The app still works, it just won't remember the ID.
  }
}

function toValidStudentId(input: string): string | null {
  const normalized = normalizeStudentId(input)
  return isValidStudentId(normalized) ? normalized : null
}

export function StudentProvider({ children }: { children: ReactNode }) {
  const [input, setStoredInput] = useState(readSavedStudentId)

  const state = useMemo<StudentState>(
    () => ({
      input,
      studentId: toValidStudentId(input),
      setInput: (value) => {
        setStoredInput(value)
        saveStudentId(toValidStudentId(value))
      },
    }),
    [input],
  )

  return <StudentContext value={state}>{children}</StudentContext>
}
