import { createContext, useContext } from 'react'

export interface StudentState {
  /** Exactly what is in the box. */
  input: string
  /** The valid student ID, or null while the box is empty or incorrect. */
  studentId: string | null
  setInput: (value: string) => void
}

export const StudentContext = createContext<StudentState | null>(null)

export function useStudent(): StudentState {
  const state = useContext(StudentContext)
  if (!state) {
    throw new Error('useStudent must be used inside StudentProvider.')
  }
  return state
}
