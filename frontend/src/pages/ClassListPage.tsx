import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router'
import { applyForSeat, listClasses, listMyHolds, type ClassSeats, type Hold } from '../api/admission'
import { currentActionError } from '../api/errors'
import { ErrorNotices } from '../components/ErrorNotice'
import { useStudent } from '../student/StudentContext'

const REFRESH_INTERVAL_MS = 3000

export function ClassListPage() {
  const { studentId } = useStudent()

  // Starting afresh when the student changes clears any message left over from the previous student.
  return <ClassList key={studentId ?? 'no-student'} studentId={studentId} />
}

function ClassList({ studentId }: { studentId: string | null }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const classes = useQuery({
    queryKey: ['classes'],
    queryFn: ({ signal }) => listClasses(signal),
    refetchInterval: REFRESH_INTERVAL_MS,
  })

  const myHolds = useQuery({
    queryKey: ['my-holds', studentId],
    queryFn: ({ signal }) => listMyHolds(studentId!, signal),
    enabled: studentId !== null,
    refetchInterval: REFRESH_INTERVAL_MS,
  })

  const apply = useMutation({
    mutationFn: (classId: string) => applyForSeat(classId, studentId!),
    onSuccess: (hold) => navigate(`/holds/${hold.holdId}`),
    // Not returned on purpose: the result should show at once, without waiting for the list to refresh.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['classes'] })
      void queryClient.invalidateQueries({ queryKey: ['my-holds'] })
    },
  })

  const activeHoldsByClass = new Map(
    (myHolds.data ?? [])
      .filter((hold) => hold.status === 'HELD' || hold.status === 'CONFIRMED')
      .map((hold) => [hold.classId, hold]),
  )

  return (
    <section>
      <h2>Class তালিকা</h2>

      <ErrorNotices
        errors={[classes.error, currentActionError(apply.error, apply.submittedAt, classes.dataUpdatedAt)]}
      />
      {studentId === null && (
        <p className="notice notice-info">আবেদন করতে উপরের ঘরে শিক্ষার্থীর জন্ম নিবন্ধন নম্বর লিখুন।</p>
      )}

      {classes.isPending && <p>লোড হচ্ছে…</p>}

      {!classes.isError && classes.data?.length === 0 && (
        <p>
          এখনো কোনো class তৈরি করা হয়নি। <Link to="/classes/new">নতুন class তৈরি করুন</Link>
        </p>
      )}

      {classes.data && classes.data.length > 0 && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Class</th>
                <th scope="col">মোট</th>
                <th scope="col">Hold-এ আছে</th>
                <th scope="col">নিশ্চিত</th>
                <th scope="col">খালি</th>
                <th scope="col">
                  <span className="visually-hidden">আবেদন</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {classes.data.map((schoolClass) => (
                <tr key={schoolClass.id}>
                  <th scope="row">{schoolClass.name}</th>
                  <td data-label="মোট">{schoolClass.totalSeats}</td>
                  <td data-label="Hold-এ আছে">{schoolClass.heldSeats}</td>
                  <td data-label="নিশ্চিত">{schoolClass.confirmedSeats}</td>
                  <td data-label="খালি">{schoolClass.availableSeats}</td>
                  <td className="row-action">
                    <ApplyAction
                      schoolClass={schoolClass}
                      activeHold={activeHoldsByClass.get(schoolClass.id)}
                      hasStudent={studentId !== null}
                      isApplying={apply.isPending && apply.variables === schoolClass.id}
                      onApply={() => apply.mutate(schoolClass.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

interface ApplyActionProps {
  schoolClass: ClassSeats
  activeHold: Hold | undefined
  hasStudent: boolean
  isApplying: boolean
  onApply: () => void
}

function ApplyAction({ schoolClass, activeHold, hasStudent, isApplying, onApply }: ApplyActionProps) {
  if (activeHold) {
    return (
      <Link to={`/holds/${activeHold.holdId}`}>
        {activeHold.status === 'CONFIRMED' ? 'ভর্তি নিশ্চিত' : 'আবেদন দেখুন'}
      </Link>
    )
  }

  if (schoolClass.availableSeats === 0) {
    return (
      <button type="button" disabled>
        Seat নেই
      </button>
    )
  }

  return (
    <button type="button" disabled={!hasStudent || isApplying} onClick={onApply}>
      {isApplying ? 'আবেদন হচ্ছে…' : 'আবেদন করুন'}
    </button>
  )
}
