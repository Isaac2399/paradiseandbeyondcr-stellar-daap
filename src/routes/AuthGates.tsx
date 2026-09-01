import type { ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/lib/auth/AuthContext'

function SessionGate({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-app text-app-muted">
      {children}
    </main>
  )
}

export function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return <SessionGate>Cargando sesión…</SessionGate>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

export function GuestRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return <SessionGate>Cargando sesión…</SessionGate>
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
