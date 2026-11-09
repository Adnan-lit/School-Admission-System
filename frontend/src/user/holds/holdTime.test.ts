import { describe, expect, it } from 'vitest'
import type { Hold } from '../../api/admission'
import { displayStatus, formatTimeLeft, millisecondsLeft, urgencyOf } from './holdTime'

function holdWith(expiresAt: string, serverTime: string): Hold {
  return { holdId: 'h1', classId: 'c1', className: 'Class 6', status: 'HELD', expiresAt, serverTime }
}

const SERVER_NOW = Date.parse('2026-11-11T10:00:00Z')

describe('millisecondsLeft', () => {
  const hold = holdWith('2026-11-11T10:01:00Z', '2026-11-11T10:00:00Z')

  it('counts down from the moment the data arrived', () => {
    expect(millisecondsLeft(hold, SERVER_NOW, SERVER_NOW)).toBe(60_000)
    expect(millisecondsLeft(hold, SERVER_NOW, SERVER_NOW + 10_000)).toBe(50_000)
  })

  it('is right even when this computer clock is an hour fast', () => {
    const wrongClock = SERVER_NOW + 3_600_000
    expect(millisecondsLeft(hold, wrongClock, wrongClock + 10_000)).toBe(50_000)
  })

  it('is right even when this computer clock is an hour slow', () => {
    const wrongClock = SERVER_NOW - 3_600_000
    expect(millisecondsLeft(hold, wrongClock, wrongClock + 10_000)).toBe(50_000)
  })

  it('never goes below zero', () => {
    expect(millisecondsLeft(hold, SERVER_NOW, SERVER_NOW + 120_000)).toBe(0)
  })
})

describe('displayStatus', () => {
  const held = holdWith('2026-11-11T10:01:00Z', '2026-11-11T10:00:00Z')

  it('shows a held application as held while any time remains', () => {
    expect(displayStatus(held, 1)).toBe('HELD')
  })

  it('shows EXPIRED the moment time runs out, even if the server has not said so yet', () => {
    expect(displayStatus(held, 0)).toBe('EXPIRED')
  })

  it('never changes a confirmed admission', () => {
    expect(displayStatus({ ...held, status: 'CONFIRMED' }, 0)).toBe('CONFIRMED')
  })
})

describe('urgencyOf', () => {
  it.each([
    [600_000, 'normal'],
    [60_001, 'normal'],
    [60_000, 'warning'],
    [15_001, 'warning'],
    [15_000, 'urgent'],
    [1_000, 'urgent'],
  ])('%i milliseconds left is %s', (timeLeftMs, expected) => {
    expect(urgencyOf(timeLeftMs)).toBe(expected)
  })
})

describe('formatTimeLeft', () => {
  it.each([
    [600_000, '10:00'],
    [600_900, '10:00'], // a hold can last a fraction of a second over, which must not show as 10:01
    [65_000, '01:05'],
    [9_000, '00:09'],
    [999, '00:00'],
    [0, '00:00'],
  ])('%i milliseconds shows as %s', (timeLeftMs, expected) => {
    expect(formatTimeLeft(timeLeftMs)).toBe(expected)
  })
})
