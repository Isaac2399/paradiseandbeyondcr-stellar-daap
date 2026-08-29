import type { IncomingMessage, ServerResponse } from 'node:http'
import { dispatchApi } from './dispatchApi.js'

type VercelRequest = IncomingMessage & {
  body?: unknown
}

export const config = {
  maxDuration: 30,
}

export default async function handler(
  req: VercelRequest,
  res: ServerResponse,
) {
  try {
    const result = await dispatchApi({
      method: req.method ?? 'GET',
      path: requestPath(req),
      cookie: req.headers.cookie,
      body: parseBody(req.body),
    })

    res.statusCode = result.status
    res.setHeader('Content-Type', 'application/json')
    if (result.setCookie) {
      res.setHeader('Set-Cookie', result.setCookie)
    }
    res.end(JSON.stringify(result.body))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno'
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: message }))
  }
}

function headerPath(req: IncomingMessage): string {
  const invoke = req.headers['x-invoke-path']
  const matched = req.headers['x-matched-path']
  const value = (Array.isArray(invoke) ? invoke[0] : invoke) ??
    (Array.isArray(matched) ? matched[0] : matched)
  return value ?? ''
}

function requestPath(req: VercelRequest): string {
  const raw = ((req.url ?? headerPath(req)).split('?')[0] ?? '').trim()
  if (raw.startsWith('/api/')) {
    return raw
  }
  if (raw.startsWith('/auth/') || raw === '/payments' || raw.startsWith('/payments')) {
    return `/api${raw}`
  }
  return raw || '/api'
}

function parseBody(body: unknown): Record<string, unknown> {
  if (!body) {
    return {}
  }
  if (typeof body === 'string') {
    if (!body.trim()) {
      return {}
    }
    return JSON.parse(body) as Record<string, unknown>
  }
  if (typeof body === 'object') {
    return body as Record<string, unknown>
  }
  return {}
}
