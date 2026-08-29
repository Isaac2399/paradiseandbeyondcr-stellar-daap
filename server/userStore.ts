import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { StoredUser } from './auth.js'
import { AuthError } from './errors.js'

export type UserStore = { users: StoredUser[] }

const DATA_DIR = join(fileURLToPath(new URL('../data', import.meta.url)))
const USERS_FILE = join(DATA_DIR, 'users.json')
const KV_KEY = 'stellar-web-app:users'

export async function loadStore(): Promise<UserStore> {
  if (kvConfigured()) {
    const raw = await kvCommand<string | UserStore | null>(['GET', KV_KEY])
    if (!raw) {
      return { users: [] }
    }
    if (typeof raw === 'string') {
      return JSON.parse(raw) as UserStore
    }
    return raw
  }

  if (process.env.VERCEL) {
    throw new AuthError(
      'En Vercel el disco no guarda usuarios. Crea un KV Store (Storage → KV) y añade KV_REST_API_URL y KV_REST_API_TOKEN. Luego vuelve a desplegar.',
      503,
    )
  }

  if (!existsSync(USERS_FILE)) {
    return { users: [] }
  }
  return JSON.parse(readFileSync(USERS_FILE, 'utf8')) as UserStore
}

export async function saveStore(store: UserStore): Promise<void> {
  if (kvConfigured()) {
    await kvCommand(['SET', KV_KEY, JSON.stringify(store)])
    return
  }

  if (process.env.VERCEL) {
    throw new AuthError(
      'En Vercel hace falta Vercel KV para guardar cuentas.',
      503,
    )
  }

  mkdirSync(dirname(USERS_FILE), { recursive: true })
  writeFileSync(USERS_FILE, JSON.stringify(store, null, 2), 'utf8')
}

function kvConfigured(): boolean {
  return Boolean(kvUrl() && kvToken())
}

function kvUrl(): string {
  return (
    process.env.KV_REST_API_URL ??
    process.env.UPSTASH_REDIS_REST_URL ??
    ''
  )
}

function kvToken(): string {
  return (
    process.env.KV_REST_API_TOKEN ??
    process.env.UPSTASH_REDIS_REST_TOKEN ??
    ''
  )
}

async function kvCommand<T>(command: unknown[]): Promise<T> {
  const response = await fetch(kvUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${kvToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  })
  if (!response.ok) {
    throw new AuthError('No se pudo acceder al almacén KV de usuarios', 500)
  }
  const payload = (await response.json()) as { result: T }
  return payload.result
}
