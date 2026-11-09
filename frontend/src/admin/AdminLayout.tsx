import { Link, Outlet } from 'react-router'

export function AdminLayout() {
  return (
    <>
      <header className="app-header app-header-admin">
        <div className="app-header-content">
          <div className="app-header-top">
            <h1>School admin প্যানেল</h1>
            <nav>
              <Link to="/">অভিভাবকদের পাতায় যান</Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="admin-main">
        <Outlet />
      </main>
    </>
  )
}
