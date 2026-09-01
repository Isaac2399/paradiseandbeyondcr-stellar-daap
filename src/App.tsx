import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/lib/auth/AuthContext'
import { AppRoutes } from '@/routes/AppRoutes'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
