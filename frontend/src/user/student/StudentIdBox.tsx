import { useRef, useState } from 'react'
import { useStudent } from './StudentContext'
import { describeStudentIdProblem, isUnfinishedStudentId, normalizeStudentId } from './studentId'

export function StudentIdBox() {
  const { input, studentId, setInput } = useStudent()
  const [isTyping, setIsTyping] = useState(false)
  const box = useRef<HTMLInputElement>(null)

  const normalizedId = normalizeStudentId(input)
  const problem = describeStudentIdProblem(normalizedId)

  // A number that is still being typed isn't a mistake yet, so it only turns red after leaving the box.
  const isError = problem !== null && !(isTyping && isUnfinishedStudentId(normalizedId))

  const clear = () => {
    setInput('')
    box.current?.focus()
  }

  return (
    <div className="student-box">
      <div className="student-box-row">
        <label htmlFor="student-id">শিক্ষার্থীর জন্ম নিবন্ধন নম্বর</label>
        <input
          ref={box}
          id="student-id"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onFocus={() => setIsTyping(true)}
          onBlur={() => setIsTyping(false)}
          inputMode="numeric"
          autoComplete="off"
          placeholder="১৭ অঙ্কের নম্বর"
          aria-describedby={studentId ? undefined : 'student-id-hint'}
          aria-invalid={isError}
        />
        {input !== '' && (
          <button type="button" className="text-button" onClick={clear}>
            মুছুন
          </button>
        )}
      </div>

      {studentId === null && (
        <p id="student-id-hint" className={isError ? 'field-hint field-hint-error' : 'field-hint'}>
          {problem ?? 'আবেদন করতে বা নিজের আবেদন দেখতে নম্বরটি লিখুন।'}
        </p>
      )}
    </div>
  )
}
