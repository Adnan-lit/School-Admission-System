import { useEffect, useState } from 'react'

const TICK_MS = 500

/** The current time, updated a couple of times a second so that countdowns move smoothly. */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(timer)
  }, [])

  return now
}
