import { useQuery } from '@tanstack/react-query'
import { listClasses } from '../api/admission'
import { ErrorNotice } from '../components/ErrorNotice'

export function ClassListPage() {
  const classes = useQuery({
    queryKey: ['classes'],
    queryFn: ({ signal }) => listClasses(signal),
    refetchInterval: 3000,
  })

  return (
    <section>
      <h2>Class তালিকা</h2>

      {classes.isError && <ErrorNotice error={classes.error} />}
      {classes.isPending && <p>লোড হচ্ছে…</p>}

      {!classes.isError && classes.data?.length === 0 && <p>এখনো কোনো class তৈরি করা হয়নি।</p>}
      {classes.data && classes.data.length > 0 && (
        <ul>
          {classes.data.map((schoolClass) => (
            <li key={schoolClass.id}>{schoolClass.name}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
