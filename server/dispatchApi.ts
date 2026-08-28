import {
  AuthError,
  authenticate,
  clearSessionCookie,
  createSessionCookie,
  createUser,
  updateUserPublicKey,
  userFromCookieHeader,
  type UserRole,
} from './auth.ts'
import { submitCustodialPayment } from './submitPayment.ts'

export async function dispatchApi(input: {
  method: string
  path: string
  cookie?: string
  body: Record<string, unknown>
}): Promise<{ status: number; body: unknown; setCookie?: string }> {
  try {
    return await route(input)
  } catch (error) {
    if (error instanceof AuthError) {
      return { status: error.status, body: { error: error.message } }
    }
    return { status: 500, body: { error: 'Error interno' } }
  }
}

async function route(input: {
  method: string
  path: string
  cookie?: string
  body: Record<string, unknown>
}): Promise<{ status: number; body: unknown; setCookie?: string }> {
  const path = input.path.split('?')[0] ?? input.path
  const method = input.method.toUpperCase()

  if (method === 'POST' && path === '/api/payments') {
    const session = await userFromCookieHeader(input.cookie)
    if (!session) {
      return { status: 401, body: { error: 'No hay sesión' } }
    }
    const result = await submitCustodialPayment({
      userId: session.id,
      destination: String(input.body.destination ?? ''),
      amount: String(input.body.amount ?? ''),
      asset: String(input.body.asset ?? ''),
      memo: String(input.body.memo ?? ''),
    })
    return { status: 200, body: result }
  }

  if (method === 'POST' && path === '/api/auth/register') {
    const user = await createUser({
      email: String(input.body.email ?? ''),
      password: String(input.body.password ?? ''),
      role: input.body.role as UserRole,
    })
    return { status: 201, body: user, setCookie: createSessionCookie(user.id) }
  }

  if (method === 'POST' && path === '/api/auth/login') {
    const user = await authenticate(
      String(input.body.email ?? ''),
      String(input.body.password ?? ''),
    )
    return { status: 200, body: user, setCookie: createSessionCookie(user.id) }
  }

  if (method === 'POST' && path === '/api/auth/logout') {
    return { status: 200, body: { ok: true }, setCookie: clearSessionCookie() }
  }

  if (method === 'GET' && path === '/api/auth/me') {
    const user = await userFromCookieHeader(input.cookie)
    if (!user) {
      return { status: 401, body: { error: 'No hay sesión' } }
    }
    return { status: 200, body: user }
  }

  if (method === 'PATCH' && path === '/api/auth/me') {
    const session = await userFromCookieHeader(input.cookie)
    if (!session) {
      return { status: 401, body: { error: 'No hay sesión' } }
    }
    const user = await updateUserPublicKey(
      session.id,
      String(input.body.publicKey ?? ''),
    )
    return { status: 200, body: user }
  }

  return { status: 404, body: { error: 'Ruta no encontrada' } }
}
