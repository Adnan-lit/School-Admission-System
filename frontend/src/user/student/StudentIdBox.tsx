import { useStudent } from './StudentContext'
import { describeStudentIdProblem, normalizeStudentId } from './studentId'

export function StudentIdBox() {
  const { input, studentId, setInput } = useStudent()
  const problem = describeStudentIdProblem(normalizeStudentId(input))

  let hint = 'আবেদন করতে বা নিজের আবেদন দেখতে নম্বরটি লিখুন।'
  if (problem) {
    hint = problem
  } else if (studentId) {
    hint = 'এই নম্বরটিই শিক্ষার্থীর পরিচয় হিসেবে ব্যবহার হচ্ছে।'
  }

  return (
    <div className="student-box">
      <label htmlFor="student-id">শিক্ষার্থীর জন্ম নিবন্ধন নম্বর</label>
      <input
        id="student-id"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        inputMode="numeric"
        autoComplete="off"
        placeholder="১৭ অঙ্কের নম্বর"
        aria-describedby="student-id-hint"
        aria-invalid={problem !== null}
      />
      <p id="student-id-hint" className={problem ? 'field-hint field-hint-error' : 'field-hint'}>
        {hint}
      </p>
    </div>
  )
}
