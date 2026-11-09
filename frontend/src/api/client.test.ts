import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from './client'
import { ApiError, currentActionError } from './errors'

function stubFetch(implementation: (url: string, options: RequestInit) => Promise<Response>) {
  const fetchMock = vi.fn(implementation)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function failureOf(request: Promise<unknown>): Promise<ApiError> {
  const result = await request.then(
    () => null,
    (error: unknown) => error,
  )
  expect(result).toBeInstanceOf(ApiError)
  return result as ApiError
}

/** A server that accepts the request and then never answers. Like a real fetch, it stops when aborted. */
function neverAnswer(_url: string, options: RequestInit) {
  return new Promise<Response>((_resolve, reject) => {
    options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
  })
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('apiRequest', () => {
  it('sends the student ID in the X-Student-Id header', async () => {
    const fetchMock = stubFetch(() => Promise.resolve(Response.json([])))

    await apiRequest('/me/holds', { studentId: '20152691234567890' })

    const [, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(options.headers).toMatchObject({ 'X-Student-Id': '20152691234567890' })
  })

  it('returns nothing for a 204 response', async () => {
    stubFetch(() => Promise.resolve(new Response(null, { status: 204 })))

    await expect(apiRequest('/holds/h1', { method: 'DELETE' })).resolves.toBeUndefined()
  })

  it('explains in Bangla when the server cannot be reached', async () => {
    stubFetch(() => Promise.reject(new TypeError('Failed to fetch')))

    const error = await failureOf(apiRequest('/classes'))

    expect(error.code).toBe('NETWORK_ERROR')
    expect(error.message).toContain('সার্ভারের সাথে যোগাযোগ')
  })

  it('turns the API error code into a readable message', async () => {
    stubFetch(() =>
      Promise.resolve(Response.json({ code: 'NO_SEATS_AVAILABLE', message: 'No seats.' }, { status: 409 })),
    )

    const error = await failureOf(apiRequest('/classes/c1/holds', { method: 'POST' }))

    expect(error.status).toBe(409)
    expect(error.message).toContain('খালি seat নেই')
  })

  it('gives up and explains when the server never answers', async () => {
    vi.useFakeTimers()
    stubFetch(neverAnswer)

    const failure = failureOf(apiRequest('/classes'))
    await vi.advanceTimersByTimeAsync(30_000)
    const error = await failure

    expect(error.code).toBe('TIMEOUT')
    expect(error.message).toContain('সাড়া দিচ্ছে না')
  })

  it('keeps waiting for a slow server until the time limit', async () => {
    vi.useFakeTimers()
    stubFetch(neverAnswer)
    let settled = false

    const request = apiRequest('/classes').finally(() => {
      settled = true
    })
    request.catch(() => {})
    await vi.advanceTimersByTimeAsync(29_000)

    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(settled).toBe(true)
  })

  it('treats a cancelled request as cancelled, not as a failure', async () => {
    stubFetch(neverAnswer)
    const controller = new AbortController()

    const request = apiRequest('/classes', { signal: controller.signal })
    controller.abort()

    await expect(request).rejects.not.toBeInstanceOf(ApiError)
  })

  it('still gives a readable message when an error response is not JSON', async () => {
    stubFetch(() => Promise.resolve(new Response('<html>Bad gateway</html>', { status: 502 })))

    const error = await failureOf(apiRequest('/classes'))

    expect(error.message).toContain('আবার চেষ্টা করুন')
  })
})

describe('currentActionError', () => {
  const networkFailure = new ApiError('NETWORK_ERROR')

  it('keeps a network failure while no newer refresh has succeeded', () => {
    expect(currentActionError(networkFailure, 2000, 1000)).toBe(networkFailure)
  })

  it('drops a network failure once a newer refresh has succeeded', () => {
    expect(currentActionError(networkFailure, 2000, 3000)).toBeNull()
  })

  it('drops a timeout once a newer refresh has succeeded', () => {
    expect(currentActionError(new ApiError('TIMEOUT'), 2000, 3000)).toBeNull()
  })

  it('keeps other failures, because a refresh does not resolve them', () => {
    const expired = new ApiError('HOLD_EXPIRED', 409)
    expect(currentActionError(expired, 2000, 3000)).toBe(expired)
  })
})
