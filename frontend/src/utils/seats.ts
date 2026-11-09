/** True when so few seats remain that it is worth pointing out: five or fewer, or the last tenth of a large class. */
export function isFewSeatsLeft(availableSeats: number, totalSeats: number): boolean {
  return availableSeats > 0 && availableSeats <= Math.max(5, Math.ceil(totalSeats * 0.1))
}
