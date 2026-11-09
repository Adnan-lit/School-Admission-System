import { useQuery } from '@tanstack/react-query'
import { listClasses } from '../api/admission'
import { ErrorNotice } from '../components/ErrorNotice'

const REFRESH_INTERVAL_MS = 3000

/** The school's live view of every class. It has no apply button, because applying belongs to the user panel. */
export function SeatOverview() {
  const classes = useQuery({
    queryKey: ['classes'],
    queryFn: ({ signal }) => listClasses(signal),
    refetchInterval: REFRESH_INTERVAL_MS,
  })

  return (
    <section>
      <h2>Seat-এর অবস্থা</h2>

      {classes.isError && <ErrorNotice error={classes.error} />}
      {classes.isPending && <p>লোড হচ্ছে…</p>}
      {!classes.isError && classes.data?.length === 0 && <p>এখনো কোনো class তৈরি করা হয়নি।</p>}

      {classes.data && classes.data.length > 0 && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Class</th>
                <th scope="col">মোট</th>
                <th scope="col">Hold-এ আছে</th>
                <th scope="col">নিশ্চিত</th>
                <th scope="col">খালি</th>
              </tr>
            </thead>
            <tbody>
              {classes.data.map((schoolClass) => (
                <tr key={schoolClass.id}>
                  <th scope="row">{schoolClass.name}</th>
                  <td data-label="মোট">{schoolClass.totalSeats}</td>
                  <td data-label="Hold-এ আছে">{schoolClass.heldSeats}</td>
                  <td data-label="নিশ্চিত">{schoolClass.confirmedSeats}</td>
                  <td data-label="খালি">{schoolClass.availableSeats}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
