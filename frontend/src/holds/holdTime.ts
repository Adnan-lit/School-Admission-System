import type { Hold, HoldStatus } from '../api/admission'

/**
 * Seconds until the hold runs out. The time is measured on the server's clock, so the countdown
 * stays right even if this computer's clock is wrong. receivedAt is when the data arrived here.
 */
export function secondsLeft(hold: Hold, receivedAt: number, now: number): number {
  const serverClockAhead = Date.parse(hold.serverTime) - receivedAt
  const millisecondsLeft = Date.parse(hold.expiresAt) - (now + serverClockAhead)
  return Math.max(0, Math.ceil(millisecondsLeft / 1000))
}

/** A hold whose time has just run out is shown as EXPIRED at once, without waiting for the next refresh. */
export function displayStatus(hold: Hold, secondsRemaining: number): HoldStatus {
  return hold.status === 'HELD' && secondsRemaining === 0 ? 'EXPIRED' : hold.status
}

export function formatTimeLeft(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
