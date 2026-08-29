import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto'
import { AuthError } from './errors.js'
import { loadStore, saveStore } from './userStore.js'

export { AuthError } from './errors.js'

export type UserRole = 'customer' | 'merchant'

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

function sessionSecret(): string {
  return process.env.SESSION_SECRET ?? 'stellar-web-app-dev-secret'
}

function cookieAttrs(): string {
  const secure = process.env.VERCEL ? '; Secure' : ''
  return `HttpOnly; Path=/; SameSite=Lax${secure}`
}

export function toPublicUser(user: StoredUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    publicKey: user.publicKey,
  }
}

export async function findUserByEmail(
  email: string,
): Promise<StoredUser | undefined> {
  const normalized = normalizeEmail(email)
  const store = await loadStore()
  return store.users.find((user) => user.email === normalized)
}

export async function findUserById(id: string): Promise<StoredUser | undefined> {
  const store = await loadStore()
  return store.users.find((user) => user.id === id)
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
  if (await findUserByEmail(email)) {
    throw new AuthError('Ya existe una cuenta con ese email', 409)
  }

  let keys: { publicKey: string; secretKey: string }
  try {
    const { provisionStellarAccount } = await import('./provisionAccount.js')
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

  const store = await loadStore()
  store.users.push(user)
  await saveStore(store)
  return toPublicUser(user)
}

export async function authenticate(
  email: string,
  password: string,
): Promise<PublicUser> {
  const user = await findUserByEmail(email)
  if (!user || !verifyPassword(password, user.salt, user.passwordHash)) {
    throw new AuthError(
      'Email o contraseña incorrectos. Las cuentas de tu PC no están en Vercel: usa Registro en este mismo enlace.',
      401,
    )
  }
  await ensureUserLoyaltyTrustline(user.id)
  return toPublicUser(user)
}

export async function ensureUserLoyaltyTrustline(userId: string): Promise<void> {
  const user = await findUserById(userId)
  if (!user?.secretKeyEnc) {
    return
  }
  const { ensureLoyaltyTrustline } = await import('./provisionAccount.js')
  try {
    await ensureLoyaltyTrustline(decryptSecret(user.secretKeyEnc))
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se pudo abrir la trustline'
    throw new AuthError(message, 502)
  }
}

export async function updateUserPublicKey(
  userId: string,
  publicKey: string,
): Promise<PublicUser> {
  if (!/^G[A-Z0-9]{55}$/.test(publicKey)) {
    throw new AuthError('La public key de Stellar no es válida', 400)
  }
  const store = await loadStore()
  const user = store.users.find((entry) => entry.id === userId)
  if (!user) {
    throw new AuthError('No hay sesión', 401)
  }
  user.publicKey = publicKey
  await saveStore(store)
  return toPublicUser(user)
}

export function createSessionCookie(userId: string): string {
  const exp = Date.now() + SESSION_TTL_MS
  const payload = `${userId}.${exp}`
  const sig = createHmac('sha256', sessionSecret()).update(payload).digest('hex')
  const token = `${payload}.${sig}`
  return `${COOKIE_NAME}=${token}; ${cookieAttrs()}; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; ${cookieAttrs()}; Max-Age=0`
}

export async function userFromCookieHeader(
  header: string | undefined,
): Promise<PublicUser | null> {
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
  const user = await findUserById(userId)
  return user ? toPublicUser(user) : null
}

export async function secretKeyForUser(userId: string): Promise<string> {
  const user = await findUserById(userId)
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
