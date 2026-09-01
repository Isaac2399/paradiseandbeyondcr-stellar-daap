import { useState, type FormEvent, type ReactNode } from 'react'

export function RoleButton({
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
      className={`flex items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-medium ${
        active
          ? 'bg-app-accent text-black'
          : 'bg-app-chip text-white/80'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

export function AuthSubmitButton({
  submitting,
  idleLabel,
  busyLabel,
}: {
  submitting: boolean
  idleLabel: string
  busyLabel: string
}) {
  return (
    <button
      type="submit"
      disabled={submitting}
      className="w-full rounded-2xl bg-app-accent py-3 text-sm font-medium text-black disabled:opacity-60"
    >
      {submitting ? busyLabel : idleLabel}
    </button>
  )
}

export function useAuthForm() {
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function runSubmit(
    event: FormEvent<HTMLFormElement>,
    action: () => Promise<void>,
    onError: (err: unknown) => string,
  ) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(onError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return { error, submitting, runSubmit }
}
