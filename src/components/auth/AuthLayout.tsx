import type { ReactNode } from 'react'

export const fieldClass =
  'w-full rounded-2xl border border-app-line bg-app-chip px-3 py-2.5 text-sm font-normal text-white outline-none placeholder:text-white/35'

export function AuthLayout({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <main className="min-h-dvh bg-app text-white">
      <div
        className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-10"
        style={{ paddingTop: 'max(1.25rem, env(safe-area-inset-top))' }}
      >
        <header className="mb-6 space-y-2">
          <p className="text-sm font-medium text-app-accent">Stellar Pay</p>
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-app-muted">{description}</p>
        </header>
        {children}
      </div>
    </main>
  )
}

export function AuthField({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-white/80">
      {label}
      {children}
    </label>
  )
}
