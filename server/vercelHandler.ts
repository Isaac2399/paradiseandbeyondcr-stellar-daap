import type { IncomingMessage, ServerResponse } from 'node:http'
import { dispatchApi } from './dispatchApi.ts'

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
}

function requestPath(req: VercelRequest): string {
  const urlPath = (req.url ?? '').split('?')[0] ?? ''
  if (urlPath.startsWith('/api/')) {
    return urlPath
  }
  return '/api'
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
