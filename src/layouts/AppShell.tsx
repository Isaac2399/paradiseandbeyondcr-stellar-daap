import { Outlet, useLocation } from 'react-router-dom'
import { BottomNav } from '@/components/navigation/BottomNav'
import { useAuth } from '@/lib/auth/AuthContext'

export function AppShell() {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    return null
  }

  return (
    <div className="min-h-dvh bg-transparent text-white">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col">
        <main
          className="app-scroll app-surface flex-1 overflow-y-auto px-5 pb-28"
          style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
        >
          <div key={location.pathname} className="app-page">
            <Outlet />
          </div>
        </main>
        <BottomNav />
      </div>
    </div>
  )
}
