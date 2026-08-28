import { AuthProvider, useAuth } from '@/lib/auth/AuthContext'
import { AuthScreen } from '@/components/auth/AuthScreen'
import HomePage from '@/pages/HomePage'

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  )
}

function Root() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 grid place-items-center text-slate-600">
        Cargando sesión…
      </main>
    )
  }

  return user ? <HomePage /> : <AuthScreen />
}
