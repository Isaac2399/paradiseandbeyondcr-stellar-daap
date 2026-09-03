import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto'
import { AuthError } from './errors.js'

export type CardStatus = 'active' | 'frozen' | 'canceled'

export type StoredCard = {
  id: string
  userId: string
  publicKey: string
  holderName: string
  brand: 'visa'
  type: 'virtual'
  last4: string
  expMonth: string
  expYear: string
  panEnc: string
  cvvEnc: string
  status: CardStatus
  dailyLimitUsd: string
  createdAt: string
}

export type CardTxStatus = 'approved' | 'declined'

export type StoredCardTx = {
  id: string
  cardId: string
  merchant: string
  amount: string
  currency: string
  status: CardTxStatus
  declineReason?: string
  declineCode?: string
  txHash?: string
  createdAt: string
}

export type CardStore = {
  cards: StoredCard[]
  transactions: StoredCardTx[]
  treasury?: {
    publicKey: string
    secretKeyEnc: string
  }
}

const CARDS_FILE = join('data', 'cards.json')
const KV_KEY = 'stellar-web-app:cards'

export async function loadCardStore(): Promise<CardStore> {
  if (kvConfigured()) {
    const raw = await kvCommand<string | CardStore | null>(['GET', KV_KEY])
    if (!raw) {
      return emptyStore()
    }
    if (typeof raw === 'string') {
      return normalizeStore(JSON.parse(raw) as CardStore)
    }
    return normalizeStore(raw)
  }

  if (process.env.VERCEL) {
    throw new AuthError(
      'En Vercel hace falta Vercel KV para persistir tarjetas.',
      503,
    )
  }

  if (!existsSync(CARDS_FILE)) {
    return emptyStore()
  }
  return normalizeStore(JSON.parse(readFileSync(CARDS_FILE, 'utf8')) as CardStore)
}

export async function saveCardStore(store: CardStore): Promise<void> {
  const next = normalizeStore(store)
  if (kvConfigured()) {
    await kvCommand(['SET', KV_KEY, JSON.stringify(next)])
    return
  }

  if (process.env.VERCEL) {
    throw new AuthError(
      'En Vercel hace falta Vercel KV para persistir tarjetas.',
      503,
    )
  }

  mkdirSync(dirname(CARDS_FILE), { recursive: true })
  writeFileSync(CARDS_FILE, JSON.stringify(next, null, 2), 'utf8')
}

export function encryptField(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', fieldKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decryptField(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(':')
  if (!ivHex || !tagHex || !dataHex) {
    throw new AuthError('Los datos sensibles de la tarjeta están corruptos', 500)
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    fieldKey(),
    Buffer.from(ivHex, 'hex'),
  )
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]).toString('utf8')
}

function emptyStore(): CardStore {
  return { cards: [], transactions: [] }
}

function normalizeStore(store: CardStore): CardStore {
  return {
    cards: store.cards ?? [],
    transactions: store.transactions ?? [],
    treasury: store.treasury,
  }
}

function fieldKey(): Buffer {
  const secret = process.env.SESSION_SECRET ?? 'stellar-web-app-dev-secret'
  return createHash('sha256').update(`card-issuing:${secret}`).digest()
}

function kvConfigured(): boolean {
  return Boolean(kvUrl() && kvToken())
}

function kvUrl(): string {
  return stripQuotes(
    process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? '',
  )
}

function kvToken(): string {
  return stripQuotes(
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? '',
  )
}

function stripQuotes(value: string): string {
  return value.replace(/^['"]+|['"]+$/g, '').trim()
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
    throw new AuthError('No se pudo acceder al almacén KV de tarjetas', 500)
  }
  const payload = (await response.json()) as { result: T }
  return payload.result
}
