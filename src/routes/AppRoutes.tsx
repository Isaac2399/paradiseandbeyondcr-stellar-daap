import { Navigate, Route, Routes } from 'react-router-dom'
import { GuestRoute, ProtectedRoute } from '@/routes/AuthGates'
import { AppShell } from '@/layouts/AppShell'
import HomePage from '@/pages/HomePage'
import LoginPage from '@/pages/LoginPage'
import MapPage from '@/pages/MapPage'
import ProfilePage from '@/pages/ProfilePage'
import RegisterPage from '@/pages/RegisterPage'
import { useAuth } from '@/lib/auth/AuthContext'

export function AppRoutes() {
  const { user } = useAuth()

  return (
    <Routes>
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
      </Route>

      <Route
        path="*"
        element={<Navigate to={user ? '/' : '/login'} replace />}
      />
    </Routes>
  )
}
