import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { cancelHold, confirmHold, getHold, type Hold, type HoldStatus } from '../api/admission'
import { currentActionError } from '../api/errors'
import { ErrorNotice, ErrorNotices } from '../components/ErrorNotice'
import { usePageTitle } from '../utils/usePageTitle'
import { displayStatus, formatTimeLeft, millisecondsLeft, urgencyOf } from './holds/holdTime'
import { StatusBadge } from './holds/StatusBadge'
import { useNow } from './holds/useNow'
import { useStudent } from './student/StudentContext'

const REFRESH_INTERVAL_MS = 3000

export function ApplicationPage() {
  const { holdId = '' } = useParams()
  const { studentId } = useStudent()

  // Starting afresh when the student changes clears any message left over from the previous student.
  return <Application key={`${holdId}:${studentId}`} holdId={holdId} studentId={studentId} />
}

function Application({ holdId, studentId }: { holdId: string; studentId: string | null }) {
  const queryClient = useQueryClient()
  const now = useNow()

  const hold = useQuery({
    queryKey: ['hold', holdId],
    queryFn: ({ signal }) => getHold(holdId, signal),
    // Finished applications can't change, so they stop refreshing. Before any data has
    // arrived it keeps trying, so the page recovers by itself if the server was down.
    refetchInterval: (query) => {
      const currentStatus = query.state.data?.status
      return currentStatus === undefined || currentStatus === 'HELD' ? REFRESH_INTERVAL_MS : false
    },
  })

  const showStatusAndRefresh = (status?: HoldStatus) => {
    if (status) {
      queryClient.setQueryData<Hold>(['hold', holdId], (current) => current && { ...current, status })
    }
    void queryClient.invalidateQueries({ queryKey: ['hold', holdId] })
    void queryClient.invalidateQueries({ queryKey: ['classes'] })
    void queryClient.invalidateQueries({ queryKey: ['my-holds'] })
  }

  const pay = useMutation({
    mutationFn: () => confirmHold(holdId, studentId!),
    onSuccess: () => showStatusAndRefresh('CONFIRMED'),
    onError: () => showStatusAndRefresh(),
  })

  const cancel = useMutation({
    mutationFn: () => cancelHold(holdId, studentId!),
    onSuccess: () => showStatusAndRefresh('CANCELLED'),
    onError: () => showStatusAndRefresh(),
  })

  const remaining = hold.data ? millisecondsLeft(hold.data, hold.dataUpdatedAt, now) : 0
  const isRunning = hold.data !== undefined && displayStatus(hold.data, remaining) === 'HELD'

  // A guardian who has moved to another browser tab can still see how long is left.
  usePageTitle(isRunning ? `${formatTimeLeft(remaining)} বাকি` : 'আবেদন')

  if (hold.isPending) {
    return (
      <section>
        <h2>আবেদন</h2>
        <p>লোড হচ্ছে…</p>
      </section>
    )
  }

  if (!hold.data) {
    return (
      <section>
        <h2>আবেদন</h2>
        <ErrorNotice error={hold.error} />
        <Link to="/">Class তালিকায় ফিরে যান</Link>
      </section>
    )
  }

  const status = displayStatus(hold.data, remaining)
  const urgency = urgencyOf(remaining)
  const isBusy = pay.isPending || cancel.isPending
  const canAct = status === 'HELD' && studentId !== null && !isBusy

  return (
    <section>
      <h2>আবেদন</h2>

      <ErrorNotices
        errors={[
          hold.error,
          currentActionError(pay.error, pay.submittedAt, hold.dataUpdatedAt),
          currentActionError(cancel.error, cancel.submittedAt, hold.dataUpdatedAt),
        ]}
      />
      {status === 'HELD' && studentId === null && (
        <p className="notice notice-info">ফি দিতে বা বাতিল করতে উপরের ঘরে শিক্ষার্থীর জন্ম নিবন্ধন নম্বর লিখুন।</p>
      )}

      <div className="card">
        <dl className="details">
          <dt>Class</dt>
          <dd>{hold.data.className}</dd>
          <dt>অবস্থা</dt>
          <dd>
            <StatusBadge status={status} />
          </dd>
        </dl>

        {status === 'HELD' && (
          <div className={`countdown countdown-${urgency}`}>
            <p className="countdown-label">মেয়াদ শেষ হতে বাকি</p>
            <p className="countdown-time" role="timer">
              {formatTimeLeft(remaining)}
            </p>
            <p className="countdown-note">
              {urgency === 'normal'
                ? 'এই সময়ের মধ্যে ভর্তি ফি না দিলে seat-টি অন্যদের জন্য খুলে যাবে।'
                : 'সময় প্রায় শেষ। এখনই ভর্তি ফি দিন, নইলে seat-টি অন্যদের জন্য খুলে যাবে।'}
            </p>
          </div>
        )}

        {status === 'CONFIRMED' && (
          <p className="notice notice-success" role="status">
            ভর্তি ফি জমা হয়েছে। ভর্তি নিশ্চিত।
          </p>
        )}
        {status === 'EXPIRED' && (
          <p className="notice notice-error" role="status">
            সময়ের মধ্যে ফি জমা না হওয়ায় আবেদনের মেয়াদ শেষ হয়ে গেছে। <Link to="/">আবার আবেদন করুন</Link>
          </p>
        )}
        {status === 'CANCELLED' && (
          <p className="notice notice-info" role="status">
            এই আবেদনটি বাতিল করা হয়েছে। <Link to="/">অন্য class-এ আবেদন করুন</Link>
          </p>
        )}

        <div className="actions">
          <button type="button" disabled={!canAct} onClick={() => pay.mutate()}>
            {pay.isPending ? 'জমা হচ্ছে…' : 'ভর্তি ফি দিন'}
          </button>
          <button type="button" className="button-secondary" disabled={!canAct} onClick={() => cancel.mutate()}>
            {cancel.isPending ? 'বাতিল হচ্ছে…' : 'বাতিল'}
          </button>
        </div>
      </div>
    </section>
  )
}
