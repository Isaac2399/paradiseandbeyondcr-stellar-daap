import { Link } from 'react-router-dom'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { RegisterForm } from '@/components/auth/RegisterForm'
import { useAuth } from '@/lib/auth/AuthContext'
import { readableError } from '@/lib/auth/readableError'

export default function RegisterPage() {
  const { register } = useAuth()

  return (
    <AuthLayout
      title="Crear cuenta"
      description="Regístrate con email y contraseña. La cuenta Stellar se crea sola en Testnet."
    >
      <RegisterForm onSubmit={register} formatError={readableError} />
      <p className="text-sm text-slate-600 text-center">
        ¿Ya tienes cuenta?{' '}
        <Link to="/login" className="font-medium text-blue-600 hover:text-blue-700">
          Iniciar sesión
        </Link>
      </p>
    </AuthLayout>
  )
}
