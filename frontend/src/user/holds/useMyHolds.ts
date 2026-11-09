import { useQuery } from '@tanstack/react-query'
import { listMyHolds } from '../../api/admission'

const REFRESH_INTERVAL_MS = 3000

/** This student's applications, kept up to date. Every part of the user panel shares the same copy. */
export function useMyHolds(studentId: string | null) {
  return useQuery({
    queryKey: ['my-holds', studentId],
    queryFn: ({ signal }) => listMyHolds(studentId!, signal),
    enabled: studentId !== null,
    refetchInterval: REFRESH_INTERVAL_MS,
  })
}
