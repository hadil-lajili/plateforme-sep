import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function Layout() {
  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: '#f8f9fc',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar />
        <main style={{
          flex: 1,
          padding: '28px 32px',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}