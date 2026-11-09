import { isFewSeatsLeft } from '../utils/seats'

export function FreeSeats({ available, total }: { available: number; total: number }) {
  let level = 'plenty'
  if (available === 0) {
    level = 'none'
  } else if (isFewSeatsLeft(available, total)) {
    level = 'few'
  }

  return <span className={`free-seats free-seats-${level}`}>{available}</span>
}
