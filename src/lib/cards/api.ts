import { AuthApiError } from '@/lib/auth/api'
import type {
  CardAuthorization,
  PublicCard,
  SecureCardDetails,
} from '@/lib/cards/types'

export async function issueCard(): Promise<PublicCard> {
  return request<PublicCard>('/api/cards/issue', { method: 'POST' })
}

export async function fetchMyCard(): Promise<PublicCard | null> {
  const response = await fetch('/api/cards/me', { credentials: 'include' })
  if (response.status === 404) {
    return null
  }
  return readOk<PublicCard>(response)
}

export async function fetchCard(id: string): Promise<PublicCard> {
  return request<PublicCard>(`/api/cards/${encodeURIComponent(id)}`)
}

export async function fetchSecureDetails(
  id: string,
): Promise<SecureCardDetails> {
  const params = new URLSearchParams({ cardId: id })
  return request<SecureCardDetails>(`/api/cards/secure-details?${params}`)
}

export async function freezeCard(id: string): Promise<PublicCard> {
  return request<PublicCard>('/api/cards/freeze', {
    method: 'POST',
    body: JSON.stringify({ cardId: id }),
  })
}

export async function unfreezeCard(id: string): Promise<PublicCard> {
  return request<PublicCard>('/api/cards/unfreeze', {
    method: 'POST',
    body: JSON.stringify({ cardId: id }),
  })
}

export async function fetchCardTransactions(
  id: string,
): Promise<CardAuthorization[]> {
  const params = new URLSearchParams({ cardId: id })
  const body = await request<{ transactions?: CardAuthorization[] }>(
    `/api/cards/transactions?${params}`,
  )
  return body.transactions ?? []
}

export async function simulateCardTransaction(input: {
  cardId?: string
  merchant: string
  amount: string
  currency?: string
}): Promise<CardAuthorization> {
  return request<CardAuthorization>('/api/cards/simulate-transaction', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  })
  return readOk<T>(response)
}

async function readOk<T>(response: Response): Promise<T> {
  const raw = await response.text()
  let body: T & { error?: string }
  try {
    body = raw
      ? (JSON.parse(raw) as T & { error?: string })
      : ({} as T & { error?: string })
  } catch {
    throw new AuthApiError(
      `El servidor respondió ${response.status} (no JSON).`,
      response.status,
    )
  }
  if (!response.ok) {
    throw new AuthApiError(body.error ?? 'Error de tarjeta', response.status)
  }
  return body
}
