import type { Hold, HoldStatus } from '../../api/admission'

/**
 * Milliseconds until the hold runs out. The time is measured on the server's clock, so the countdown
 * stays right even if this computer's clock is wrong. receivedAt is when the data arrived here.
 */
export function millisecondsLeft(hold: Hold, receivedAt: number, now: number): number {
  const serverClockAhead = Date.parse(hold.serverTime) - receivedAt
  return Math.max(0, Date.parse(hold.expiresAt) - (now + serverClockAhead))
}

/** A hold whose time has just run out is shown as EXPIRED at once, without waiting for the next refresh. */
export function displayStatus(hold: Hold, timeLeftMs: number): HoldStatus {
  return hold.status === 'HELD' && timeLeftMs === 0 ? 'EXPIRED' : hold.status
}

export type Urgency = 'normal' | 'warning' | 'urgent'

/** How pressing the remaining time is, which decides the colour it is shown in. */
export function urgencyOf(timeLeftMs: number): Urgency {
  if (timeLeftMs <= 15_000) {
    return 'urgent'
  }
  return timeLeftMs <= 60_000 ? 'warning' : 'normal'
}

/** Rounds down, so a hold of ten minutes starts at 10:00 like any other countdown. */
export function formatTimeLeft(timeLeftMs: number): string {
  const totalSeconds = Math.floor(timeLeftMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
