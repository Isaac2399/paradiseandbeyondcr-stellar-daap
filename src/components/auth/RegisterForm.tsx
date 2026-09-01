import { useState } from 'react'
import { Store, User } from 'lucide-react'
import { AuthField, fieldClass } from '@/components/auth/AuthLayout'
import {
  AuthSubmitButton,
  RoleButton,
  useAuthForm,
} from '@/components/auth/formHelpers'
import type { UserRole } from '@/types/user'

type RegisterFormProps = {
  onSubmit: (input: {
    email: string
    password: string
    role: UserRole
  }) => Promise<void>
  formatError: (err: unknown) => string
}

export function RegisterForm({ onSubmit, formatError }: RegisterFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('customer')
  const { error, submitting, runSubmit } = useAuthForm()

  return (
    <form
      className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4"
      onSubmit={(event) =>
        void runSubmit(
          event,
          () => onSubmit({ email, password, role }),
          formatError,
        )
      }
    >
      <AuthField label="Email">
        <input
          className={fieldClass}
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </AuthField>

      <AuthField label="Contraseña">
        <input
          className={fieldClass}
          type="password"
          name="password"
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </AuthField>

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

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <AuthSubmitButton
        submitting={submitting}
        idleLabel="Crear cuenta"
        busyLabel="Creando cuenta en Stellar…"
      />
    </form>
  )
}
