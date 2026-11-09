import { Link, useMatch } from 'react-router'
import { displayStatus, formatTimeLeft, millisecondsLeft, urgencyOf } from './holds/holdTime'
import { useMyHolds } from './holds/useMyHolds'
import { useNow } from './holds/useNow'
import { useStudent } from './student/StudentContext'

/** Reminds a guardian who has left the application page that a clock is still running. */
export function ActiveApplicationBanner() {
  const { studentId } = useStudent()
  const holds = useMyHolds(studentId)
  const now = useNow()
  const viewedHoldId = useMatch('/holds/:holdId')?.params.holdId

  const running = (holds.data ?? [])
    .map((hold) => ({ hold, timeLeft: millisecondsLeft(hold, holds.dataUpdatedAt, now) }))
    .filter(({ hold, timeLeft }) => displayStatus(hold, timeLeft) === 'HELD' && hold.holdId !== viewedHoldId)
    .sort((first, second) => first.timeLeft - second.timeLeft)

  if (running.length === 0) {
    return null
  }

  const [soonest, ...others] = running

  return (
    <div className={`running-banner running-banner-${urgencyOf(soonest.timeLeft)}`}>
      <div className="running-banner-content">
        <span>
          “{soonest.hold.className}”-এর ফি দেওয়ার সময় বাকি <strong>{formatTimeLeft(soonest.timeLeft)}</strong>
          {others.length > 0 && ` (আরও ${others.length.toLocaleString('bn-BD')}টি আবেদন চলছে)`}
        </span>
        <Link to={`/holds/${soonest.hold.holdId}`} className="link-button">
          ফি দিন
        </Link>
      </div>
    </div>
  )
}
