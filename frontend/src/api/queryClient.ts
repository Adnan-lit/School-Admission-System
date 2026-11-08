import { QueryClient } from '@tanstack/react-query'
import { ApiError, NETWORK_ERROR } from './errors'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // One quick retry hides a brief network blip. Anything else won't be fixed by asking again.
      retry: (failureCount, error) =>
        error instanceof ApiError && error.code === NETWORK_ERROR && failureCount < 1,
      retryDelay: 1000,
    },
  },
})
