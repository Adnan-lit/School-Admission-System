import { NavLink, Outlet } from 'react-router'
import { StudentIdBox } from './student/StudentIdBox'
import { StudentProvider } from './student/StudentProvider'

export function UserLayout() {
  return (
    <StudentProvider>
      <header className="app-header">
        <div className="app-header-content">
          <h1>স্কুল ভর্তি</h1>
          <StudentIdBox />
          <nav>
            <NavLink to="/" end>
              Class তালিকা
            </NavLink>
            <NavLink to="/my-applications">আমার আবেদন</NavLink>
          </nav>
        </div>
      </header>

      <main>
        <Outlet />
      </main>
    </StudentProvider>
  )
}
