import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClass } from '../api/admission'
import { ErrorNotice } from '../components/ErrorNotice'
import { validateClassForm, type ClassFormProblems } from './classForm'

export function CreateClassForm() {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [totalSeats, setTotalSeats] = useState('')
  const [problems, setProblems] = useState<ClassFormProblems>({})

  const create = useMutation({
    mutationFn: createClass,
    onSuccess: () => {
      setName('')
      setTotalSeats('')
      void queryClient.invalidateQueries({ queryKey: ['classes'] })
    },
  })

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    const result = validateClassForm(name, totalSeats)
    if (!result.valid) {
      create.reset()
      setProblems(result.problems)
      return
    }

    setProblems({})
    create.mutate(result.newClass)
  }

  return (
    <section>
      <h2>Class তৈরি</h2>

      {create.isError && <ErrorNotice error={create.error} />}
      {create.isSuccess && (
        <p className="notice notice-success" role="status">
          “{create.data.name}” তৈরি হয়েছে।
        </p>
      )}

      <form className="form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="class-name">Class-এর নাম</label>
          <input
            id="class-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="যেমন: Class 6 – Morning Shift"
            autoComplete="off"
            aria-invalid={problems.name !== undefined}
            aria-describedby="class-name-hint"
          />
          <p id="class-name-hint" className={problems.name ? 'field-hint field-hint-error' : 'field-hint'}>
            {problems.name ?? 'প্রতিটি shift-এর জন্য আলাদা class তৈরি করুন।'}
          </p>
        </div>

        <div className="field">
          <label htmlFor="class-seats">মোট seat সংখ্যা</label>
          <input
            id="class-seats"
            value={totalSeats}
            onChange={(event) => setTotalSeats(event.target.value)}
            inputMode="numeric"
            placeholder="যেমন: 120"
            autoComplete="off"
            aria-invalid={problems.totalSeats !== undefined}
            aria-describedby="class-seats-hint"
          />
          {problems.totalSeats && (
            <p id="class-seats-hint" className="field-hint field-hint-error">
              {problems.totalSeats}
            </p>
          )}
        </div>

        <button type="submit" disabled={create.isPending}>
          {create.isPending ? 'তৈরি হচ্ছে…' : 'Class তৈরি করুন'}
        </button>
      </form>
    </section>
  )
}
