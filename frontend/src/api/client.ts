import { apiBaseUrl } from '../config'
import { ApiError, NETWORK_ERROR, UNEXPECTED_RESPONSE } from './errors'

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE'
  studentId?: string
  body?: unknown
  signal?: AbortSignal
}

/** Calls the API. Every failure comes out as an ApiError with a message for the user. */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', studentId, body, signal } = options

  const headers: Record<string, string> = {}
  if (studentId) {
    headers['X-Student-Id'] = studentId
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  let response: Response
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method,
      headers,
      signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (cause) {
    // A cancelled request isn't a failure: the page simply no longer needs the answer.
    if (signal?.aborted) {
      throw cause
    }
    throw new ApiError(NETWORK_ERROR)
  }

  if (!response.ok) {
    throw new ApiError(await readErrorCode(response), response.status)
  }

  if (response.status === 204) {
    return undefined as T
  }

  try {
    return (await response.json()) as T
  } catch {
    throw new ApiError(UNEXPECTED_RESPONSE, response.status)
  }
}

async function readErrorCode(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json()
    if (body && typeof body === 'object' && 'code' in body && typeof body.code === 'string') {
      return body.code
    }
  } catch {
    // A body that isn't JSON is handled by the general error below.
  }

  return UNEXPECTED_RESPONSE
}
