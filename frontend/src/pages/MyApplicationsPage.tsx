import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { listMyHolds } from '../api/admission'
import { ErrorNotice } from '../components/ErrorNotice'
import { displayStatus, formatTimeLeft, secondsLeft } from '../holds/holdTime'
import { StatusBadge } from '../holds/StatusBadge'
import { useNow } from '../holds/useNow'
import { useStudent } from '../student/StudentContext'

const REFRESH_INTERVAL_MS = 3000

export function MyApplicationsPage() {
  const { studentId } = useStudent()

  return (
    <section>
      <h2>আমার আবেদন</h2>
      {studentId === null ? (
        <p className="notice notice-info">নিজের আবেদন দেখতে উপরের ঘরে শিক্ষার্থীর জন্ম নিবন্ধন নম্বর লিখুন।</p>
      ) : (
        <ApplicationList key={studentId} studentId={studentId} />
      )}
    </section>
  )
}

function ApplicationList({ studentId }: { studentId: string }) {
  const now = useNow()

  const holds = useQuery({
    queryKey: ['my-holds', studentId],
    queryFn: ({ signal }) => listMyHolds(studentId, signal),
    refetchInterval: REFRESH_INTERVAL_MS,
  })

  return (
    <>
      {holds.isError && <ErrorNotice error={holds.error} />}
      {holds.isPending && <p>লোড হচ্ছে…</p>}

      {!holds.isError && holds.data?.length === 0 && (
        <p>
          এই শিক্ষার্থীর এখনো কোনো আবেদন নেই। <Link to="/">Class তালিকা দেখুন</Link>
        </p>
      )}

      {holds.data && holds.data.length > 0 && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Class</th>
                <th scope="col">অবস্থা</th>
                <th scope="col">সময় বাকি</th>
                <th scope="col">
                  <span className="visually-hidden">বিস্তারিত</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {holds.data.map((hold) => {
                const remaining = secondsLeft(hold, holds.dataUpdatedAt, now)
                const status = displayStatus(hold, remaining)

                return (
                  <tr key={hold.holdId}>
                    <th scope="row">{hold.className}</th>
                    <td data-label="অবস্থা">
                      <StatusBadge status={status} />
                    </td>
                    <td data-label="সময় বাকি">{status === 'HELD' ? formatTimeLeft(remaining) : '—'}</td>
                    <td className="row-action">
                      <Link to={`/holds/${hold.holdId}`}>{status === 'HELD' ? 'ফি দিন বা বাতিল করুন' : 'বিস্তারিত'}</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
