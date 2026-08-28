import { useState, type FormEvent, type ReactNode } from 'react'
import { Store, User } from 'lucide-react'
import { useAuth } from '@/lib/auth/AuthContext'
import { AuthApiError } from '@/lib/auth/api'
import type { UserRole } from '@/types/user'

export function AuthScreen() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('register')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('customer')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      if (mode === 'login') {
        await login({ email, password })
      } else {
        await register({ email, password, role })
      }
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : 'No se pudo completar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8 text-slate-900">
      <div className="max-w-md mx-auto space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Stellar Pay</h1>
          <p className="text-sm text-slate-600">
            Entra con email y contraseña. La cuenta Stellar se crea sola en
            Testnet.
          </p>
        </header>

        <div className="flex bg-white p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            className={`flex-1 py-2 rounded-lg text-sm font-medium ${
              mode === 'register' ? 'bg-blue-600 text-white' : 'text-slate-600'
            }`}
            onClick={() => setMode('register')}
          >
            Registro
          </button>
          <button
            type="button"
            className={`flex-1 py-2 rounded-lg text-sm font-medium ${
              mode === 'login' ? 'bg-blue-600 text-white' : 'text-slate-600'
            }`}
            onClick={() => setMode('login')}
          >
            Iniciar sesión
          </button>
        </div>

        <form
          className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4"
          onSubmit={(event) => void onSubmit(event)}
        >
          <label className="grid gap-1 text-sm font-medium">
            Email
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 font-normal"
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className="grid gap-1 text-sm font-medium">
            Contraseña
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 font-normal"
              type="password"
              name="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          {mode === 'register' ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Rol</legend>
              <div className="grid grid-cols-2 gap-2">
                <RoleButton
                  active={role === 'customer'}
                  onClick={() => setRole('customer')}
                  icon={<User className="w-4 h-4" />}
                  label="Cliente"
                />
                <RoleButton
                  active={role === 'merchant'}
                  onClick={() => setRole('merchant')}
                  icon={<Store className="w-4 h-4" />}
                  label="Empresa"
                />
              </div>
            </fieldset>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-blue-600 text-white py-2.5 text-sm font-medium disabled:opacity-60"
          >
            {submitting
              ? mode === 'register'
                ? 'Creando cuenta en Stellar…'
                : 'Entrando…'
              : mode === 'register'
                ? 'Crear cuenta'
                : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  )
}

function RoleButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm border ${
        active
          ? 'bg-blue-600 text-white border-blue-600'
          : 'bg-white text-slate-700 border-slate-200'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}
