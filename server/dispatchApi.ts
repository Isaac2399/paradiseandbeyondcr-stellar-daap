import { submitCustodialPayment } from './submitPayment.js'
import {
  AuthError,
  authenticate,
  clearSessionCookie,
  createSessionCookie,
  createUser,
  ensureUserLoyaltyTrustline,
  updateUserPlace,
  updateUserPublicKey,
  userFromCookieHeader,
  listPublicPlaces,
  type UserRole,
} from './auth.js'
import {
  handleSep24Deposit,
  handleSep24Transaction,
  handleSep24Trustline,
} from './sep24Api.js'
import { parsePlaceBody, reverseNominatim, searchNominatim } from './places.js'

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
      return {
        status: error.status,
        body: error.code
          ? { error: error.message, code: error.code }
          : { error: error.message },
      }
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
  const path = (input.path.split('?')[0] ?? input.path).replace(/\/$/, '') || '/'
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
    try {
      await ensureUserLoyaltyTrustline(user.id)
    } catch {
      // Keep the session even if Horizon is slow; register/login still require the trustline.
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

  if (method === 'GET' && path === '/api/places') {
    const session = await userFromCookieHeader(input.cookie)
    if (!session) {
      return { status: 401, body: { error: 'No hay sesión' } }
    }
    return { status: 200, body: { places: await listPublicPlaces() } }
  }

  if (method === 'GET' && path === '/api/places/search') {
    const session = await userFromCookieHeader(input.cookie)
    if (!session) {
      return { status: 401, body: { error: 'No hay sesión' } }
    }
    if (session.role !== 'merchant') {
      return { status: 403, body: { error: 'Solo empresas pueden buscar direcciones' } }
    }
    const hits = await searchNominatim(String(input.body.q ?? ''))
    return { status: 200, body: { hits } }
  }

  if (method === 'POST' && path === '/api/places/reverse') {
    const session = await userFromCookieHeader(input.cookie)
    if (!session) {
      return { status: 401, body: { error: 'No hay sesión' } }
    }
    if (session.role !== 'merchant') {
      return { status: 403, body: { error: 'Solo empresas pueden fijar el pin' } }
    }
    const lat = Number(input.body.lat)
    const lng = Number(input.body.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { status: 400, body: { error: 'Coordenadas no válidas' } }
    }
    const address = await reverseNominatim(lat, lng)
    return { status: 200, body: { address, lat, lng } }
  }

  if (method === 'PUT' && path === '/api/places') {
    const session = await userFromCookieHeader(input.cookie)
    if (!session) {
      return { status: 401, body: { error: 'No hay sesión' } }
    }
    const user = await updateUserPlace(session.id, parsePlaceBody(input.body))
    return { status: 200, body: user }
  }

  if (method === 'DELETE' && path === '/api/places') {
    const session = await userFromCookieHeader(input.cookie)
    if (!session) {
      return { status: 401, body: { error: 'No hay sesión' } }
    }
    const user = await updateUserPlace(session.id, null)
    return { status: 200, body: user }
  }

  if (path.startsWith('/api/sep24/')) {
    const session = await userFromCookieHeader(input.cookie)
    if (!session) {
      return {
        status: 401,
        body: { error: 'No hay sesión', code: 'expired_session' },
      }
    }
    if (method === 'POST' && path === '/api/sep24/deposit') {
      return { status: 200, body: await handleSep24Deposit(session, input.body) }
    }
    if (method === 'POST' && path === '/api/sep24/transaction') {
      return {
        status: 200,
        body: await handleSep24Transaction(session, input.body),
      }
    }
    if (method === 'POST' && path === '/api/sep24/trustline') {
      return { status: 200, body: await handleSep24Trustline(session) }
    }
  }

  return { status: 404, body: { error: 'Ruta no encontrada' } }
}
