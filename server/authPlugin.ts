import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
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

export function authApiPlugin(): Plugin {
  return {
    name: 'stellar-auth-api',
    configureServer(server) {
      server.middlewares.use(handleApi)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handleApi)
    },
  }
}

async function handleApi(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) {
  const url = req.url ?? ''
  if (!url.startsWith('/api/auth') && !url.startsWith('/api/payments')) {
    next()
    return
  }

  try {
    const path = url.split('?')[0]

    if (req.method === 'POST' && path === '/api/payments') {
      const session = userFromCookieHeader(req.headers.cookie)
      if (!session) {
        json(res, 401, { error: 'No hay sesión' })
        return
      }
      const body = await readJson(req)
      const result = await submitCustodialPayment({
        userId: session.id,
        destination: String(body.destination ?? ''),
        amount: String(body.amount ?? ''),
        asset: String(body.asset ?? ''),
        memo: String(body.memo ?? ''),
      })
      json(res, 200, result)
      return
    }

    if (!url.startsWith('/api/auth')) {
      json(res, 404, { error: 'Ruta no encontrada' })
      return
    }
    if (req.method === 'POST' && path === '/api/auth/register') {
      const body = await readJson(req)
      const user = await createUser({
        email: String(body.email ?? ''),
        password: String(body.password ?? ''),
        role: body.role as UserRole,
      })
      json(res, 201, user, createSessionCookie(user.id))
      return
    }

    if (req.method === 'POST' && path === '/api/auth/login') {
      const body = await readJson(req)
      const user = authenticate(String(body.email ?? ''), String(body.password ?? ''))
      json(res, 200, user, createSessionCookie(user.id))
      return
    }

    if (req.method === 'POST' && path === '/api/auth/logout') {
      json(res, 200, { ok: true }, clearSessionCookie())
      return
    }

    if (req.method === 'GET' && path === '/api/auth/me') {
      const user = userFromCookieHeader(req.headers.cookie)
      if (!user) {
        json(res, 401, { error: 'No hay sesión' })
        return
      }
      json(res, 200, user)
      return
    }

    if (req.method === 'PATCH' && path === '/api/auth/me') {
      const session = userFromCookieHeader(req.headers.cookie)
      if (!session) {
        json(res, 401, { error: 'No hay sesión' })
        return
      }
      const body = await readJson(req)
      const user = updateUserPublicKey(session.id, String(body.publicKey ?? ''))
      json(res, 200, user)
      return
    }

    json(res, 404, { error: 'Ruta no encontrada' })
  } catch (error) {
    if (error instanceof AuthError) {
      json(res, error.status, { error: error.message })
      return
    }
    json(res, 500, { error: 'Error interno' })
  }
}

function json(
  res: ServerResponse,
  status: number,
  body: unknown,
  setCookie?: string,
) {
  const payload = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  if (setCookie) {
    res.setHeader('Set-Cookie', setCookie)
  }
  res.end(payload)
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) {
    return {}
  }
  return JSON.parse(raw) as Record<string, unknown>
}
