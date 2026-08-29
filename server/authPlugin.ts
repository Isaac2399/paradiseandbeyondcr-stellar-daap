import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { dispatchApi } from './dispatchApi.ts'

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
    const path = url.split('?')[0] ?? url
    const body =
      req.method === 'GET' || req.method === 'HEAD' ? {} : await readJson(req)
    const result = await dispatchApi({
      method: req.method ?? 'GET',
      path,
      cookie: req.headers.cookie,
      body,
    })
    const payload = JSON.stringify(result.body)
    res.statusCode = result.status
    res.setHeader('Content-Type', 'application/json')
    if (result.setCookie) {
      res.setHeader('Set-Cookie', result.setCookie)
    }
    res.end(payload)
  } catch {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Error interno' }))
  }
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
