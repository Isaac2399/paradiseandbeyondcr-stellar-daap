import { AuthApiError } from '@/lib/auth/api'
import type { AdminOverview } from '@/types/admin'

export async function fetchAdminOverview(): Promise<AdminOverview> {
  const response = await fetch('/api/admin/overview', { credentials: 'include' })
  const raw = await response.text()
  let body: AdminOverview & { error?: string }
  try {
    body = raw ? (JSON.parse(raw) as AdminOverview & { error?: string }) : ({} as AdminOverview)
  } catch {
    throw new AuthApiError(
      `El servidor respondió ${response.status} (no JSON). Revisa /api/admin/overview en Vercel.`,
      response.status,
    )
  }
  if (!response.ok) {
    throw new AuthApiError(body.error ?? 'No se pudo cargar el panel', response.status)
  }
  return body
}
