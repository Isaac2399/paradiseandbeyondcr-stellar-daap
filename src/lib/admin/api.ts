import { AuthApiError } from '@/lib/auth/api'
import type { AdminOverview } from '@/types/admin'

export async function fetchAdminOverview(): Promise<AdminOverview> {
  const response = await fetch('/api/admin/overview', { credentials: 'include' })
  const body = (await response.json()) as AdminOverview & { error?: string }
  if (!response.ok) {
    throw new AuthApiError(body.error ?? 'No se pudo cargar el panel', response.status)
  }
  return body
}
