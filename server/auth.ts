import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { StrKey } from '@stellar/stellar-sdk'
import { provisionStellarAccount } from './provisionAccount.ts'

export type UserRole = 'customer' | 'merchant'

const DATA_DIR = join(fileURLToPath(new URL('../data', import.meta.url)))
const USERS_FILE = join(DATA_DIR, 'users.json')
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
const COOKIE_NAME = 'stellar_session'

export type StoredUser = {
  id: string
  email: string
  passwordHash: string
  salt: string
  role: UserRole
  publicKey: string
  secretKeyEnc?: string
  createdAt: string
}

export type PublicUser = {
  id: string
  email: string
  role: UserRole
  publicKey: string
}

type UserStore = { users: StoredUser[] }

function sessionSecret(): string {
  return process.env.SESSION_SECRET ?? 'stellar-web-app-dev-secret'
}

function loadStore(): UserStore {
  if (!existsSync(USERS_FILE)) {
    return { users: [] }
  }
  const raw = readFileSync(USERS_FILE, 'utf8')
  return JSON.parse(raw) as UserStore
}

function saveStore(store: UserStore) {
  mkdirSync(dirname(USERS_FILE), { recursive: true })
  writeFileSync(USERS_FILE, JSON.stringify(store, null, 2), 'utf8')
}

export function toPublicUser(user: StoredUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    publicKey: user.publicKey,
  }
}

export function findUserByEmail(email: string): StoredUser | undefined {
  const normalized = normalizeEmail(email)
  return loadStore().users.find((user) => user.email === normalized)
}

export function findUserById(id: string): StoredUser | undefined {
  return loadStore().users.find((user) => user.id === id)
}

export async function createUser(input: {
  email: string
  password: string
  role: UserRole
}): Promise<PublicUser> {
  const email = normalizeEmail(input.email)
  if (!isEmail(email)) {
    throw new AuthError('El email no es válido', 400)
  }
  if (input.password.length < 8) {
    throw new AuthError('La contraseña debe tener al menos 8 caracteres', 400)
  }
  if (input.role !== 'customer' && input.role !== 'merchant') {
    throw new AuthError('El rol debe ser customer o merchant', 400)
  }
  if (findUserByEmail(email)) {
    throw new AuthError('Ya existe una cuenta con ese email', 409)
  }

  let keys: { publicKey: string; secretKey: string }
  try {
    keys = await provisionStellarAccount()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo crear la cuenta Stellar'
    throw new AuthError(message, 502)
  }

  const salt = randomBytes(16).toString('hex')
  const user: StoredUser = {
    id: randomBytes(12).toString('hex'),
    email,
    salt,
    passwordHash: hashPassword(input.password, salt),
    role: input.role,
    publicKey: keys.publicKey,
    secretKeyEnc: encryptSecret(keys.secretKey),
    createdAt: new Date().toISOString(),
  }

  const store = loadStore()
  store.users.push(user)
  saveStore(store)
  return toPublicUser(user)
}

export function authenticate(email: string, password: string): PublicUser {
  const user = findUserByEmail(email)
  if (!user || !verifyPassword(password, user.salt, user.passwordHash)) {
    throw new AuthError('Email o contraseña incorrectos', 401)
  }
  return toPublicUser(user)
}

export function updateUserPublicKey(userId: string, publicKey: string): PublicUser {
  if (!StrKey.isValidEd25519PublicKey(publicKey)) {
    throw new AuthError('La public key de Stellar no es válida', 400)
  }
  const store = loadStore()
  const user = store.users.find((entry) => entry.id === userId)
  if (!user) {
    throw new AuthError('No hay sesión', 401)
  }
  user.publicKey = publicKey
  saveStore(store)
  return toPublicUser(user)
}

export function createSessionCookie(userId: string): string {
  const exp = Date.now() + SESSION_TTL_MS
  const payload = `${userId}.${exp}`
  const sig = createHmac('sha256', sessionSecret()).update(payload).digest('hex')
  const token = `${payload}.${sig}`
  return `${COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`
}

export function userFromCookieHeader(header: string | undefined): PublicUser | null {
  const token = readCookie(header, COOKIE_NAME)
  if (!token) {
    return null
  }
  const parts = token.split('.')
  if (parts.length !== 3) {
    return null
  }
  const [userId, exp, sig] = parts
  const payload = `${userId}.${exp}`
  const expected = createHmac('sha256', sessionSecret()).update(payload).digest('hex')
  if (!safeEqual(sig, expected) || Number(exp) < Date.now()) {
    return null
  }
  const user = findUserById(userId)
  return user ? toPublicUser(user) : null
}

export class AuthError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'AuthError'
    this.status = status
  }
}

export function secretKeyForUser(userId: string): string {
  const user = findUserById(userId)
  if (!user?.secretKeyEnc) {
    throw new AuthError(
      'Esta cuenta no tiene llave custodial; no se puede firmar el pago.',
      400,
    )
  }
  return decryptSecret(user.secretKeyEnc)
}

function encryptSecret(secret: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

function decryptSecret(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(':')
  if (!ivHex || !tagHex || !dataHex) {
    throw new AuthError('La llave custodial está corrupta', 500)
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(ivHex, 'hex'),
  )
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]).toString('utf8')
}

function encryptionKey(): Buffer {
  return createHash('sha256').update(sessionSecret()).digest()
}

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString('hex')
}

function verifyPassword(password: string, salt: string, hash: string): boolean {
  const next = hashPassword(password, salt)
  return safeEqual(next, hash)
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) {
    return false
  }
  return timingSafeEqual(left, right)
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function isEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function readCookie(header: string | undefined, name: string): string | null {
  if (!header) {
    return null
  }
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) {
      return rest.join('=')
    }
  }
  return null
}
