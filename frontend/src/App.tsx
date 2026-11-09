import { Link, Route, Routes } from 'react-router'
import { AdminLayout } from './admin/AdminLayout'
import { AdminPage } from './admin/AdminPage'
import { ApplicationPage } from './user/ApplicationPage'
import { ClassListPage } from './user/ClassListPage'
import { MyApplicationsPage } from './user/MyApplicationsPage'
import { UserLayout } from './user/UserLayout'
import { usePageTitle } from './utils/usePageTitle'

function NotFound() {
  usePageTitle('পেজটি পাওয়া যায়নি')

  return (
    <main>
      <h2>এই পেজটি পাওয়া যায়নি</h2>
      <Link to="/">Class তালিকায় ফিরে যান</Link>
    </main>
  )
}

function App() {
  return (
    <Routes>
      <Route element={<UserLayout />}>
        <Route index element={<ClassListPage />} />
        <Route path="holds/:holdId" element={<ApplicationPage />} />
        <Route path="my-applications" element={<MyApplicationsPage />} />
      </Route>

      <Route path="admin" element={<AdminLayout />}>
        <Route index element={<AdminPage />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App
