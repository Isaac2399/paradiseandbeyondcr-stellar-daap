import type {
  Sep24ErrorCode,
  Sep24InteractiveResponse,
  Sep24Transaction,
} from './types'

export class Sep24ApiError extends Error {
  status: number
  code?: Sep24ErrorCode
  constructor(message: string, status: number, code?: Sep24ErrorCode) {
    super(message)
    this.name = 'Sep24ApiError'
    this.status = status
    this.code = code
  }
}

export async function startSep24Deposit(amount?: string): Promise<Sep24InteractiveResponse> {
  return request<Sep24InteractiveResponse>('/api/sep24/deposit', {
    amount: amount || undefined,
  })
}

export async function fetchSep24Transaction(
  id: string,
): Promise<Sep24Transaction> {
  const body = await request<{ transaction: Sep24Transaction }>(
    '/api/sep24/transaction',
    { id },
  )
  return body.transaction
}

export async function ensureUsdcTrustline(): Promise<void> {
  await request('/api/sep24/trustline', {})
}

async function request<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const raw = await response.text()
  type Envelope = T & { error?: string; code?: string }
  let parsed: Envelope
  try {
    parsed = raw ? (JSON.parse(raw) as Envelope) : ({} as Envelope)
  } catch {
    throw new Sep24ApiError(`El servidor respondió ${response.status}`, response.status)
  }
  if (!response.ok) {
    throw new Sep24ApiError(
      parsed.error || 'No se pudo completar la operación SEP-24',
      response.status,
      parsed.code,
    )
  }
  return parsed
}
