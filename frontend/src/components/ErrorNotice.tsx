import { getErrorMessage } from '../api/errors'

export function ErrorNotice({ error }: { error: unknown }) {
  return (
    <p className="notice notice-error" role="alert">
      {getErrorMessage(error)}
    </p>
  )
}

/** Shows each different message once, for pages where several requests can fail for the same reason. */
export function ErrorNotices({ errors }: { errors: unknown[] }) {
  const messages = new Set(errors.filter(Boolean).map(getErrorMessage))

  return [...messages].map((message) => (
    <p key={message} className="notice notice-error" role="alert">
      {message}
    </p>
  ))
}
