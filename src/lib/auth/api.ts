import type { AppUser } from '@/types/user'

export class AuthApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'AuthApiError'
    this.status = status
  }
}

export async function registerUser(input: {
  email: string
  password: string
  role: AppUser['role']
}): Promise<AppUser> {
  return request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function loginUser(input: {
  email: string
  password: string
}): Promise<AppUser> {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function logoutUser(): Promise<void> {
  await request('/api/auth/logout', { method: 'POST' })
}

export async function fetchSession(): Promise<AppUser | null> {
  const response = await fetch('/api/auth/me', { credentials: 'include' })
  if (response.status === 401) {
    return null
  }
  if (!response.ok) {
    throw new AuthApiError('No se pudo leer la sesión', response.status)
  }
  return (await response.json()) as AppUser
}

export async function updateStoredPublicKey(publicKey: string): Promise<AppUser> {
  return request('/api/auth/me', {
    method: 'PATCH',
    body: JSON.stringify({ publicKey }),
  })
}

async function request(path: string, init: RequestInit): Promise<AppUser> {
  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  const raw = await response.text()
  let body: AppUser & { error?: string }
  try {
    body = raw ? (JSON.parse(raw) as AppUser & { error?: string }) : ({} as AppUser)
  } catch {
    throw new AuthApiError(
      `El servidor respondió ${response.status} (no JSON). Revisa las funciones de Vercel.`,
      response.status,
    )
  }
  if (!response.ok) {
    throw new AuthApiError(body.error ?? 'Error de autenticación', response.status)
  }
  return body
}
