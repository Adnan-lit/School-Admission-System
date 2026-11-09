import { Link } from 'react-router'
import { ErrorNotice } from '../components/ErrorNotice'
import { usePageTitle } from '../utils/usePageTitle'
import { displayStatus, formatTimeLeft, millisecondsLeft } from './holds/holdTime'
import { StatusBadge } from './holds/StatusBadge'
import { useMyHolds } from './holds/useMyHolds'
import { useNow } from './holds/useNow'
import { useStudent } from './student/StudentContext'

export function MyApplicationsPage() {
  usePageTitle('আমার আবেদন')
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

  const holds = useMyHolds(studentId)

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
                const remaining = millisecondsLeft(hold, holds.dataUpdatedAt, now)
                const status = displayStatus(hold, remaining)

                return (
                  <tr key={hold.holdId}>
                    <th scope="row">{hold.className}</th>
                    <td data-label="অবস্থা">
                      <StatusBadge status={status} />
                    </td>
                    <td data-label="সময় বাকি">{status === 'HELD' ? formatTimeLeft(remaining) : '—'}</td>
                    <td className="row-action">
                      <Link to={`/holds/${hold.holdId}`} className={status === 'HELD' ? 'link-button' : undefined}>
                        {status === 'HELD' ? 'ফি দিন বা বাতিল করুন' : 'বিস্তারিত'}
                      </Link>
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
