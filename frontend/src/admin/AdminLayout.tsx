import { Link, Outlet } from 'react-router'

export function AdminLayout() {
  return (
    <>
      <header className="app-header app-header-admin">
        <div className="app-header-content">
          <h1>School admin প্যানেল</h1>
          <nav>
            <Link to="/">অভিভাবকদের পাতায় যান</Link>
          </nav>
        </div>
      </header>

      <main>
        <Outlet />
      </main>
    </>
  )
}
