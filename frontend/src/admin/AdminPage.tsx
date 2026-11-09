import { CreateClassForm } from './CreateClassForm'
import { SeatOverview } from './SeatOverview'

export function AdminPage() {
  return (
    <div className="admin-page">
      <CreateClassForm />
      <SeatOverview />
    </div>
  )
}
