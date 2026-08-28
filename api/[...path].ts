import type { IncomingMessage, ServerResponse } from 'node:http'
import { dispatchApi } from '../server/dispatchApi.ts'

type VercelRequest = IncomingMessage & {
  body?: unknown
  query?: { path?: string | string[] }
}

export const config = {
  maxDuration: 30,
}

export default async function handler(
  req: VercelRequest,
  res: ServerResponse,
) {
  const path = requestPath(req)
  const result = await dispatchApi({
    method: req.method ?? 'GET',
    path,
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
  const parts = req.query?.path
  const suffix = Array.isArray(parts) ? parts.join('/') : (parts ?? '')
  return suffix ? `/api/${suffix}` : '/api'
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
