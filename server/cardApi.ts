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

const ACTIONS = new Set([
  'issue',
  'simulate-transaction',
  'me',
  'freeze',
  'unfreeze',
  'secure-details',
  'transactions',
])

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
  const cardId = cardIdFrom(input)

  if (method === 'POST' && path === '/api/cards/issue') {
    const card = await provider.issue(userId)
    return { status: 201, body: card }
  }

  if (method === 'POST' && path === '/api/cards/simulate-transaction') {
    const authorization = await provider.simulateTransaction(userId, {
      cardId: cardId || undefined,
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

  if (method === 'POST' && isAction(path, 'freeze')) {
    return { status: 200, body: await provider.freeze(userId, requireCardId(cardId, path)) }
  }

  if (method === 'POST' && isAction(path, 'unfreeze')) {
    return {
      status: 200,
      body: await provider.unfreeze(userId, requireCardId(cardId, path)),
    }
  }

  if (method === 'GET' && isAction(path, 'secure-details')) {
    return {
      status: 200,
      body: await provider.getSecureDetails(userId, requireCardId(cardId, path)),
    }
  }

  if (method === 'GET' && isAction(path, 'transactions')) {
    return {
      status: 200,
      body: {
        transactions: await provider.listTransactions(
          userId,
          requireCardId(cardId, path),
        ),
      },
    }
  }

  const cardMatch = path.match(/^\/api\/cards\/([^/]+)$/)
  if (cardMatch?.[1] && method === 'GET' && !ACTIONS.has(cardMatch[1])) {
    return { status: 200, body: await provider.get(userId, cardMatch[1]) }
  }

  return { status: 404, body: { error: 'Ruta de tarjeta no encontrada' } }
}

function isAction(path: string, action: string): boolean {
  return (
    path === `/api/cards/${action}` ||
    new RegExp(`^/api/cards/[^/]+/${action}$`).test(path)
  )
}

function cardIdFrom(input: ApiInput): string {
  const path = (input.path.split('?')[0] ?? input.path).replace(/\/$/, '')
  const nested = path.match(/^\/api\/cards\/([^/]+)\/(?:freeze|unfreeze|secure-details|transactions)$/)
  return (
    nested?.[1] ??
    optionalString(input.body.cardId) ??
    optionalString(input.body.id) ??
    ''
  )
}

function requireCardId(cardId: string, path: string): string {
  if (cardId && !ACTIONS.has(cardId)) {
    return cardId
  }
  throw new AuthError(`Falta cardId para ${path}`, 400)
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}
