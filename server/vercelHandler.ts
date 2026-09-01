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
      body: await readRequestBody(req),
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
  if (
    raw.startsWith('/auth/') ||
    raw === '/payments' ||
    raw.startsWith('/payments') ||
    raw.startsWith('/sep24') ||
    raw.startsWith('/places')
  ) {
    return `/api${raw}`
  }
  return raw || '/api'
}

function parseBody(body: unknown): Record<string, unknown> {
  if (!body) {
    return {}
  }
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(body)) {
    const raw = body.toString('utf8')
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
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

async function readRequestBody(req: VercelRequest): Promise<Record<string, unknown>> {
  const parsed = parseBody(req.body)
  if (Object.keys(parsed).length > 0) {
    return parsed
  }
  if (req.method === 'GET' || req.method === 'HEAD') {
    const search = (req.url ?? '').split('?')[1]
    if (!search) {
      return {}
    }
    return Object.fromEntries(new URLSearchParams(search).entries())
  }
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw.trim()) {
    return {}
  }
  return JSON.parse(raw) as Record<string, unknown>
}
