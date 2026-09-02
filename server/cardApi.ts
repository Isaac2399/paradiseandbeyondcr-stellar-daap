import { AuthError } from './errors.js'
import { userFromCookieHeader } from './auth.js'
import { getCardProvider } from './cardIssuing.js'

type ApiInput = {
  method: string
  path: string
  cookie?: string
  body: Record<string, unknown>
}

type ApiResult = { status: number; body: unknown; setCookie?: string }

export async function handleCardRoutes(
  input: ApiInput,
): Promise<ApiResult | null> {
  const path = (input.path.split('?')[0] ?? input.path).replace(/\/$/, '') || '/'
  if (!path.startsWith('/api/cards')) {
    return null
  }

  const session = await userFromCookieHeader(input.cookie)
  if (!session?.id) {
    throw new AuthError('No hay sesión', 401)
  }

  const method = input.method.toUpperCase()
  const provider = getCardProvider()
  const userId = session.id

  if (method === 'POST' && path === '/api/cards/issue') {
    const card = await provider.issue(userId)
    return { status: 201, body: card }
  }

  if (method === 'POST' && path === '/api/cards/simulate-transaction') {
    const authorization = await provider.simulateTransaction(userId, {
      cardId: optionalString(input.body.cardId),
      merchant: String(input.body.merchant ?? ''),
      amount: String(input.body.amount ?? ''),
      currency: optionalString(input.body.currency),
    })
    return { status: 200, body: authorization }
  }

  if (method === 'GET' && (path === '/api/cards' || path === '/api/cards/me')) {
    const card = await provider.getMine(userId)
    if (!card) {
      return { status: 404, body: { error: 'No hay tarjeta emitida' } }
    }
    return { status: 200, body: card }
  }

  const freeze = path.match(/^\/api\/cards\/([^/]+)\/freeze$/)
  if (freeze?.[1] && method === 'POST') {
    return { status: 200, body: await provider.freeze(userId, freeze[1]) }
  }

  const unfreeze = path.match(/^\/api\/cards\/([^/]+)\/unfreeze$/)
  if (unfreeze?.[1] && method === 'POST') {
    return { status: 200, body: await provider.unfreeze(userId, unfreeze[1]) }
  }

  const secure = path.match(/^\/api\/cards\/([^/]+)\/secure-details$/)
  if (secure?.[1] && method === 'GET') {
    return { status: 200, body: await provider.getSecureDetails(userId, secure[1]) }
  }

  const transactions = path.match(/^\/api\/cards\/([^/]+)\/transactions$/)
  if (transactions?.[1] && method === 'GET') {
    return {
      status: 200,
      body: { transactions: await provider.listTransactions(userId, transactions[1]) },
    }
  }

  const cardId = path.match(/^\/api\/cards\/([^/]+)$/)
  if (cardId?.[1] && method === 'GET') {
    return { status: 200, body: await provider.get(userId, cardId[1]) }
  }

  return { status: 404, body: { error: 'Ruta de tarjeta no encontrada' } }
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}
