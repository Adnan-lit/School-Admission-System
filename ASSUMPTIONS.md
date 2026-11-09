# Assumptions


## API responses

The brief specifies 409 when no seats are left and 204 for a successful cancel. Everything else below is my decision.

| Situation | Response | Why |
|---|---|---|
| Missing or invalid `X-Student-Id`, or an invalid body | 400 | The request itself is wrong |
| Unknown or badly formed class or application ID | 404 | IDs are ours to define, so a malformed one simply doesn't exist |
| Someone else's application | 403 | The rule says only your own application can be confirmed |
| Already has an active or confirmed application in that class | 409 | It conflicts with the current state. It is reported ahead of "no seats" because it is more useful to the student |
| Confirming or cancelling an expired application | 409 | The action no longer fits its state |
| Confirming a cancelled application | 409 | Same reason |
| Confirming an already confirmed application | 200, no change | A retry of something that worked shouldn't look like a failure |
| Cancelling an already cancelled application | 204, no change | Same reason |
| Cancelling a confirmed admission | 409 | The fee has been paid and there is no refund process |

Every error response has the body `{ "code": "...", "message": "..." }`, including unknown addresses and unsupported methods. The UI uses `code` to choose a message in Bangla. The one exception is a request so malformed that the web server rejects it before it reaches the application, which gets an empty 400.

## Classes and applications

- A student can apply again after an application expires or is cancelled.
- A student can hold seats in several classes at once, because the limit in the brief is per class and each shift is its own class.
- `totalSeats` must be a whole number of at least 1, sent as a JSON number. `"120"` as text is rejected.
- Class names can repeat, because the contract defines no conflict response for creating a class. The ID is what identifies a class.
- Class names are trimmed, limited to 200 characters, and cannot contain control characters.
- A student ID must be exactly 17 digits from 0 to 9. Nothing else about it is checked.
- `X-Student-Id` is not proof of identity. With no login, as the brief requires, anyone who knows a number can act as that student.
- `GET /holds/{holdId}` needs no header in the contract, so application IDs are random UUIDs and the response leaves out the student ID.

## Time and expiry

- `expiresAt` is in whole seconds, like the contract's example, and rounded up. A hold therefore lasts the full configured time and at most one second more.
- All expiry checks use the database clock, so every backend process agrees on the time.
- A seat is free the moment its hold expires, because every count and status check compares `expires_at` directly. A background job records `EXPIRED` in the table every 5 seconds, so the stored status can lag, but the API never does.

## Additions to the contract

The contract allows extra response fields. Two were added:

- `className` on `GET /holds/{holdId}`, for the application screen.
- `serverTime` on `GET /holds/{holdId}` and `GET /me/holds`, so the countdown is right even if the user's computer clock is wrong.

## UI

- Seat counts and applications refresh every 3 seconds. Refreshing pauses while a tab is hidden and catches up when the tab is shown again.
- The ID box also accepts Bangla digits, spaces and dashes, and converts them to plain digits.
- Cancelling takes one click with no confirmation step. If seats remain, the student can apply again.
- The school admin and guardians have separate panels in the same web app. The admin panel at `/admin` creates classes and shows live seat counts, and the user panel holds everything for guardians.
- The admin panel has no login, because the brief requires none and the contract has no way to authorise `POST /classes`. Anyone with the address can use it. The user panel does not link to it.
- A request that gets no answer for 30 seconds is abandoned and the user is told. If the server did process it, the next refresh shows the application.

## Keeping seats correct across backend processes (bonus)

Every change to a class's applications (applying, confirming or cancelling) runs in a transaction that first locks that class's row with `SELECT ... FOR UPDATE`. Requests for the same class therefore run one at a time, and different classes don't block each other.

- The lock is held by PostgreSQL rather than by the application, so it works across any number of backend processes.
- The checks after the lock are separate statements. Under READ COMMITTED each statement sees the latest committed data, while a single combined statement would keep its view from before it waited for the lock.
- Seat counts are calculated from the applications themselves, so there is no counter that can drift.
- A partial unique index in the database also refuses a second active application for the same student and class.
- The background job uses `FOR UPDATE SKIP LOCKED`, so it never waits on a request or on the same job in another process.
- Each backend's connection pool is capped at 40, so two processes stay within PostgreSQL's default limit of 100 connections.
- Each backend runs at most 3 applications per class and 10 overall at once, and the rest wait in memory. This keeps database connections free, so a rush can't delay payments, cancellations, page refreshes or other classes. It plays no part in seat safety, which comes from the database lock.

To check this, run the load test described in the [README](README.md#run-the-tests). It sends 2,000 applicants for 100 seats, split across two backend processes.

