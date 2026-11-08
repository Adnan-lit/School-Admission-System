export const NETWORK_ERROR = 'NETWORK_ERROR'
export const UNEXPECTED_RESPONSE = 'UNEXPECTED_RESPONSE'

const GENERAL_MESSAGE = 'কিছু একটা সমস্যা হয়েছে। একটু পরে আবার চেষ্টা করুন।'

const MESSAGES: Record<string, string> = {
  [NETWORK_ERROR]: 'সার্ভারের সাথে যোগাযোগ করা যাচ্ছে না। ইন্টারনেট সংযোগ দেখে একটু পরে আবার চেষ্টা করুন।',
  [UNEXPECTED_RESPONSE]: GENERAL_MESSAGE,
  INVALID_REQUEST: 'দেওয়া তথ্যে ভুল আছে। ঠিক করে আবার চেষ্টা করুন।',
  CLASS_NOT_FOUND: 'এই class-টি খুঁজে পাওয়া যায়নি।',
  HOLD_NOT_FOUND: 'এই আবেদনটি খুঁজে পাওয়া যায়নি।',
  NOT_YOUR_HOLD: 'এই আবেদনটি অন্য শিক্ষার্থীর। উপরের জন্ম নিবন্ধন নম্বরটি ঠিক আছে কি না দেখুন।',
  ALREADY_APPLIED: 'এই শিক্ষার্থীর এই class-এ একটি চলমান আবেদন বা নিশ্চিত ভর্তি আগে থেকেই আছে।',
  NO_SEATS_AVAILABLE: 'দুঃখিত, এই class-এ এখন কোনো খালি seat নেই।',
  HOLD_EXPIRED: 'এই আবেদনের মেয়াদ শেষ হয়ে গেছে। চাইলে আবার আবেদন করতে পারেন।',
  HOLD_CANCELLED: 'এই আবেদনটি আগেই বাতিল করা হয়েছে।',
  HOLD_CONFIRMED: 'এই ভর্তি নিশ্চিত হয়ে গেছে, তাই আর বাতিল করা যাবে না।',
  INTERNAL_ERROR: 'সার্ভারে একটি সমস্যা হয়েছে। একটু পরে আবার চেষ্টা করুন।',
}

/** A failed API call, carrying a message that is ready to show to the user. */
export class ApiError extends Error {
  readonly code: string
  readonly status: number | undefined

  constructor(code: string, status?: number) {
    super(MESSAGES[code] ?? GENERAL_MESSAGE)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

export function getErrorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : GENERAL_MESSAGE
}

/** A button's "can't reach the server" message is out of date once a later refresh has succeeded. */
export function currentActionError(error: unknown, submittedAt: number, lastRefreshedAt: number): unknown {
  const isNetworkFailure = error instanceof ApiError && error.code === NETWORK_ERROR
  return isNetworkFailure && lastRefreshedAt > submittedAt ? null : error
}
