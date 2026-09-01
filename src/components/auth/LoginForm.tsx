import { useState } from 'react'
import { AuthField, fieldClass } from '@/components/auth/AuthLayout'
import { AuthSubmitButton, useAuthForm } from '@/components/auth/formHelpers'

type LoginFormProps = {
  onSubmit: (input: { email: string; password: string }) => Promise<void>
  formatError: (err: unknown) => string
}

export function LoginForm({ onSubmit, formatError }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { error, submitting, runSubmit } = useAuthForm()

  return (
    <form
      className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4"
      onSubmit={(event) =>
        void runSubmit(event, () => onSubmit({ email, password }), formatError)
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
          autoComplete="current-password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </AuthField>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <AuthSubmitButton
        submitting={submitting}
        idleLabel="Entrar"
        busyLabel="Entrando…"
      />
    </form>
  )
}
