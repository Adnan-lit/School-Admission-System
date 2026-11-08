import { Link, NavLink, Route, Routes } from 'react-router'
import { ClassListPage } from './pages/ClassListPage'
import { StudentIdBox } from './student/StudentIdBox'

function NotFound() {
  return (
    <section>
      <h2>এই পেজটি পাওয়া যায়নি</h2>
      <Link to="/">Class তালিকায় ফিরে যান</Link>
    </section>
  )
}

function App() {
  return (
    <>
      <header className="app-header">
        <div className="app-header-content">
          <h1>স্কুল ভর্তি</h1>
          <StudentIdBox />
          <nav>
            <NavLink to="/" end>
              Class তালিকা
            </NavLink>
          </nav>
        </div>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<ClassListPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </>
  )
}

export default App
