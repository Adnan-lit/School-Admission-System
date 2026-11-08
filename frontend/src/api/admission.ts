import { apiRequest } from './client'

export type HoldStatus = 'HELD' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED'

export interface ClassSeats {
  id: string
  name: string
  totalSeats: number
  heldSeats: number
  confirmedSeats: number
  availableSeats: number
}

export interface NewClass {
  name: string
  totalSeats: number
}

export interface CreatedClass {
  id: string
  name: string
  totalSeats: number
}

export interface CreatedHold {
  holdId: string
  classId: string
  studentId: string
  status: HoldStatus
  expiresAt: string
}

export interface Hold {
  holdId: string
  classId: string
  className: string
  status: HoldStatus
  expiresAt: string
  serverTime: string
}

export function listClasses(signal?: AbortSignal): Promise<ClassSeats[]> {
  return apiRequest<ClassSeats[]>('/classes', { signal })
}

export function createClass(newClass: NewClass): Promise<CreatedClass> {
  return apiRequest<CreatedClass>('/classes', { method: 'POST', body: newClass })
}

export function applyForSeat(classId: string, studentId: string): Promise<CreatedHold> {
  return apiRequest<CreatedHold>(`/classes/${classId}/holds`, { method: 'POST', studentId })
}

export function listMyHolds(studentId: string, signal?: AbortSignal): Promise<Hold[]> {
  return apiRequest<Hold[]>('/me/holds', { studentId, signal })
}

export function getHold(holdId: string, signal?: AbortSignal): Promise<Hold> {
  return apiRequest<Hold>(`/holds/${encodeURIComponent(holdId)}`, { signal })
}

export function confirmHold(holdId: string, studentId: string): Promise<void> {
  return apiRequest<void>(`/holds/${encodeURIComponent(holdId)}/confirm`, { method: 'POST', studentId })
}

export function cancelHold(holdId: string, studentId: string): Promise<void> {
  return apiRequest<void>(`/holds/${encodeURIComponent(holdId)}`, { method: 'DELETE', studentId })
}
