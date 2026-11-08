import { getErrorMessage } from '../api/errors'

export function ErrorNotice({ error }: { error: unknown }) {
  return (
    <p className="notice notice-error" role="alert">
      {getErrorMessage(error)}
    </p>
  )
}
