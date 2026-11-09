import { NavLink, Outlet } from 'react-router'
import { ActiveApplicationBanner } from './ActiveApplicationBanner'
import { StudentIdBox } from './student/StudentIdBox'
import { StudentProvider } from './student/StudentProvider'

export function UserLayout() {
  return (
    <StudentProvider>
      <header className="app-header">
        <div className="app-header-content">
          <div className="app-header-top">
            <h1>স্কুল ভর্তি</h1>
            <nav>
              <NavLink to="/" end>
                Class তালিকা
              </NavLink>
              <NavLink to="/my-applications">আমার আবেদন</NavLink>
            </nav>
          </div>
          <StudentIdBox />
        </div>
      </header>

      <ActiveApplicationBanner />

      <main>
        <Outlet />
      </main>
    </StudentProvider>
  )
}
