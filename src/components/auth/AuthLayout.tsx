import type { ReactNode } from 'react'

const fieldClass =
  'rounded-lg border border-slate-200 px-3 py-2 font-normal'

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
    <main className="min-h-screen bg-slate-50 p-4 md:p-8 text-slate-900">
      <div className="max-w-md mx-auto space-y-6">
        <header className="space-y-1">
          <p className="text-sm font-medium text-slate-500">Stellar Pay</p>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-sm text-slate-600">{description}</p>
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
    <label className="grid gap-1 text-sm font-medium">
      {label}
      {children}
    </label>
  )
}

export { fieldClass }
