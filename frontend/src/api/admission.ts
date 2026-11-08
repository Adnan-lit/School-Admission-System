import { apiRequest } from './client'

export interface ClassSeats {
  id: string
  name: string
  totalSeats: number
  heldSeats: number
  confirmedSeats: number
  availableSeats: number
}

export function listClasses(signal?: AbortSignal): Promise<ClassSeats[]> {
  return apiRequest<ClassSeats[]>('/classes', { signal })
}
