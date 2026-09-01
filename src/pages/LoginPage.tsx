import { Link } from 'react-router-dom'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { LoginForm } from '@/components/auth/LoginForm'
import { useAuth } from '@/lib/auth/AuthContext'
import { readableError } from '@/lib/auth/readableError'

export default function LoginPage() {
  const { login } = useAuth()

  return (
    <AuthLayout
      title="Iniciar sesión"
      description="Entra con el email y la contraseña de tu cuenta."
    >
      <LoginForm onSubmit={login} formatError={readableError} />
      <p className="text-sm text-slate-600 text-center">
        ¿No tienes cuenta?{' '}
        <Link to="/register" className="font-medium text-blue-600 hover:text-blue-700">
          Crear cuenta
        </Link>
      </p>
    </AuthLayout>
  )
}
