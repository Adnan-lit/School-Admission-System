import { usePageTitle } from '../utils/usePageTitle'
import { CreateClassForm } from './CreateClassForm'
import { SeatOverview } from './SeatOverview'

export function AdminPage() {
  usePageTitle('School admin প্যানেল')

  return (
    <div className="admin-page">
      <CreateClassForm />
      <SeatOverview />
    </div>
  )
}
