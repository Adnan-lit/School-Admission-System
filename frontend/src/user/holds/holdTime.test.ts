import { describe, expect, it } from 'vitest'
import type { Hold } from '../../api/admission'
import { displayStatus, formatTimeLeft, secondsLeft } from './holdTime'

function holdWith(expiresAt: string, serverTime: string): Hold {
  return { holdId: 'h1', classId: 'c1', className: 'Class 6', status: 'HELD', expiresAt, serverTime }
}

const SERVER_NOW = Date.parse('2026-11-11T10:00:00Z')

describe('secondsLeft', () => {
  const hold = holdWith('2026-11-11T10:01:00Z', '2026-11-11T10:00:00Z')

  it('counts down from the moment the data arrived', () => {
    expect(secondsLeft(hold, SERVER_NOW, SERVER_NOW)).toBe(60)
    expect(secondsLeft(hold, SERVER_NOW, SERVER_NOW + 10_000)).toBe(50)
  })

  it('is right even when this computer clock is an hour fast', () => {
    const wrongClock = SERVER_NOW + 3_600_000
    expect(secondsLeft(hold, wrongClock, wrongClock + 10_000)).toBe(50)
  })

  it('is right even when this computer clock is an hour slow', () => {
    const wrongClock = SERVER_NOW - 3_600_000
    expect(secondsLeft(hold, wrongClock, wrongClock + 10_000)).toBe(50)
  })

  it('never goes below zero', () => {
    expect(secondsLeft(hold, SERVER_NOW, SERVER_NOW + 120_000)).toBe(0)
  })
})

describe('displayStatus', () => {
  const held = holdWith('2026-11-11T10:01:00Z', '2026-11-11T10:00:00Z')

  it('shows a held application as held while time remains', () => {
    expect(displayStatus(held, 1)).toBe('HELD')
  })

  it('shows EXPIRED the moment time runs out, even if the server has not said so yet', () => {
    expect(displayStatus(held, 0)).toBe('EXPIRED')
  })

  it('never changes a confirmed admission', () => {
    expect(displayStatus({ ...held, status: 'CONFIRMED' }, 0)).toBe('CONFIRMED')
  })
})

describe('formatTimeLeft', () => {
  it.each([
    [600, '10:00'],
    [65, '01:05'],
    [9, '00:09'],
    [0, '00:00'],
  ])('%i seconds shows as %s', (seconds, expected) => {
    expect(formatTimeLeft(seconds)).toBe(expected)
  })
})
