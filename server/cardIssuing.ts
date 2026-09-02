/**
 * Card issuing service (Rain Cards–compatible sandbox).
 *
 * The HTTP surface under `/api/cards/*` stays stable. Swap the provider
 * implementation when production credentials exist:
 *
 *   RAIN_API_KEY + RAIN_API_BASE_URL  →  Rain Cards (or another BaaS)
 *   unset                             →  local Testnet sandbox
 *
 * PAN / CVV never leave this module except via `getSecureDetails`.
 * Secret keys never go to the browser.
 */
import { randomBytes } from 'node:crypto'
import { Horizon, Keypair, Networks, StrKey } from '@stellar/stellar-sdk'
import { AuthError } from './errors.js'
import { findUserById, secretKeyForUser } from './auth.js'
import {
  ensureUsdcTrustline,
  horizonUrl,
  isTestnet,
  networkPassphrase,
  provisionStellarAccount,
  usdcAssetFromEnv,
} from './provisionAccount.js'
import { submitCustodialPayment } from './submitPayment.js'
import {
  decryptField,
  encryptField,
  loadCardStore,
  saveCardStore,
  type StoredCard,
  type StoredCardTx,
} from './cardStore.js'

export type PublicCard = {
  id: string
  userId: string
  publicKey: string
  holderName: string
  brand: 'visa'
  type: 'virtual'
  last4: string
  expMonth: string
  expYear: string
  status: StoredCard['status']
  limits: {
    daily: { amount: string; spent: string; remaining: string; currency: 'USD' }
  }
  balance: { available: string; currency: string }
  settlementAccount: string
  createdAt: string
}

export type SecureCardDetails = {
  pan: string
  cvv: string
  expMonth: string
  expYear: string
}

export type CardAuthorization = {
  id: string
  cardId: string
  merchant: string
  amount: string
  currency: string
  status: 'approved' | 'declined'
  declineReason?: string
  declineCode?: string
  txHash?: string
  stellarExpertUrl?: string
  createdAt: string
}

export type CardIssuingProvider = {
  issue(userId: string): Promise<PublicCard>
  get(userId: string, cardId: string): Promise<PublicCard>
  getMine(userId: string): Promise<PublicCard | null>
  getSecureDetails(userId: string, cardId: string): Promise<SecureCardDetails>
  freeze(userId: string, cardId: string): Promise<PublicCard>
  unfreeze(userId: string, cardId: string): Promise<PublicCard>
  listTransactions(userId: string, cardId: string): Promise<CardAuthorization[]>
  simulateTransaction(
    userId: string,
    input: { cardId?: string; merchant: string; amount: string; currency?: string },
  ): Promise<CardAuthorization>
}

const DEFAULT_DAILY_LIMIT = '500.00'
const RESERVED_IDS = new Set(['issue', 'simulate-transaction', 'me'])

export function getCardProvider(): CardIssuingProvider {
  if (readEnv('RAIN_API_KEY') && readEnv('RAIN_API_BASE_URL')) {
    return createRainProvider()
  }
  return createSandboxProvider()
}

/**
 * Placeholder for the production BaaS. The method names and payloads match
 * this sandbox so the frontend and `/api/cards/*` routes do not change.
 * Fill in the vendor HTTP calls when Rain (or another issuer) credentials
 * are available.
 */
function createRainProvider(): CardIssuingProvider {
  const base = readEnv('RAIN_API_BASE_URL').replace(/\/$/, '')
  void base
  throw new AuthError(
    'Rain Cards está configurado pero el adaptador de producción aún no está cableado. Quita RAIN_API_KEY para usar el sandbox local.',
    501,
  )
}

function createSandboxProvider(): CardIssuingProvider {
  return {
    async issue(userId) {
      const existing = await findCardByUser(userId)
      if (existing) {
        return toPublicCard(existing)
      }

      const user = await findUserById(userId)
      if (!user) {
        throw new AuthError('No hay sesión', 401)
      }

      const secret = await secretKeyForUser(userId)
      const spendKey = Keypair.fromSecret(secret).publicKey()
      await ensureUsdcTrustline(secret)
      await ensureTreasury()

      const now = new Date()
      const exp = new Date(now)
      exp.setFullYear(exp.getFullYear() + 3)
      const pan = generateVisaPan()
      const card: StoredCard = {
        id: `card_${randomBytes(8).toString('hex')}`,
        userId,
        publicKey: spendKey,
        holderName: holderNameFromEmail(user.email),
        brand: 'visa',
        type: 'virtual',
        last4: pan.slice(-4),
        expMonth: String(exp.getMonth() + 1).padStart(2, '0'),
        expYear: String(exp.getFullYear()).slice(-2),
        panEnc: encryptField(pan),
        cvvEnc: encryptField(generateCvv()),
        status: 'active',
        dailyLimitUsd: dailyLimitFromEnv(),
        createdAt: now.toISOString(),
      }

      const store = await loadCardStore()
      store.cards.push(card)
      await saveCardStore(store)
      return toPublicCard(card)
    },

    async get(userId, cardId) {
      return toPublicCard(await requireOwnedCard(userId, cardId))
    },

    async getMine(userId) {
      const card = await findCardByUser(userId)
      return card ? toPublicCard(card) : null
    },

    async getSecureDetails(userId, cardId) {
      const card = await requireOwnedCard(userId, cardId)
      return {
        pan: decryptField(card.panEnc),
        cvv: decryptField(card.cvvEnc),
        expMonth: card.expMonth,
        expYear: card.expYear,
      }
    },

    async freeze(userId, cardId) {
      return setStatus(userId, cardId, 'frozen')
    },

    async unfreeze(userId, cardId) {
      return setStatus(userId, cardId, 'active')
    },

    async listTransactions(userId, cardId) {
      await requireOwnedCard(userId, cardId)
      const store = await loadCardStore()
      return store.transactions
        .filter((tx) => tx.cardId === cardId)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .map(toAuthorization)
    },

    async simulateTransaction(userId, input) {
      const merchant = String(input.merchant ?? '').trim()
      if (merchant.length < 2) {
        throw new AuthError('Indica el nombre del comercio', 400)
      }
      if (merchant.length > 28) {
        throw new AuthError('El comercio no puede superar 28 caracteres (memo Stellar)', 400)
      }
      const amount = String(input.amount ?? '').trim()
      if (!/^\d+(\.\d{1,7})?$/.test(amount) || Number(amount) <= 0) {
        throw new AuthError('El monto no es válido', 400)
      }

      const currency = normalizeCurrency(input.currency)
      const card =
        (input.cardId
          ? await requireOwnedCard(userId, input.cardId)
          : await findCardByUser(userId)) ?? null
      if (!card) {
        throw new AuthError('Emite una tarjeta antes de simular un cargo', 404)
      }

      if (card.status === 'frozen') {
        return recordAuthorization(card, {
          merchant,
          amount,
          currency,
          status: 'declined',
          declineCode: 'card_frozen',
          declineReason: 'La tarjeta está congelada',
        })
      }
      if (card.status === 'canceled') {
        return recordAuthorization(card, {
          merchant,
          amount,
          currency,
          status: 'declined',
          declineCode: 'card_canceled',
          declineReason: 'La tarjeta está cancelada',
        })
      }

      const spent = await spentLast24h(card.id)
      const remaining = Math.max(0, Number(card.dailyLimitUsd) - spent)
      if (Number(amount) > remaining + 1e-7) {
        return recordAuthorization(card, {
          merchant,
          amount,
          currency,
          status: 'declined',
          declineCode: 'limit_exceeded',
          declineReason: `Supera el límite diario (quedan ${remaining.toFixed(2)} USD)`,
        })
      }

      const treasury = await ensureTreasury()
      if (treasury.publicKey === card.publicKey) {
        return recordAuthorization(card, {
          merchant,
          amount,
          currency,
          status: 'declined',
          declineCode: 'invalid_destination',
          declineReason: 'La tesorería no puede coincidir con la wallet del titular',
        })
      }

      const available = await loadAssetBalance(card.publicKey, currency)
      const reserve = currency === 'XLM' ? 2 : 0
      const spendable = Math.max(0, available - reserve)
      if (spendable + 1e-7 < Number(amount)) {
        return recordAuthorization(card, {
          merchant,
          amount,
          currency,
          status: 'declined',
          declineCode: 'insufficient_funds',
          declineReason:
            currency === 'XLM'
              ? `Saldo insuficiente en XLM (gastable ${spendable.toFixed(2)} tras reserva de red)`
              : `Saldo insuficiente en ${currency} (disponible ${trimAmount(available)}). Agrega USDC desde Inicio.`,
        })
      }

      try {
        const payment = await submitCustodialPayment({
          userId,
          destination: treasury.publicKey,
          amount,
          asset: currency,
          memo: merchant,
        })
        return recordAuthorization(card, {
          merchant,
          amount,
          currency,
          status: 'approved',
          txHash: payment.hash,
        })
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Error de red en Testnet'
        return recordAuthorization(card, {
          merchant,
          amount,
          currency,
          status: 'declined',
          declineCode: 'network_error',
          declineReason: message,
        })
      }
    },
  }
}

async function setStatus(
  userId: string,
  cardId: string,
  status: StoredCard['status'],
): Promise<PublicCard> {
  const card = await requireOwnedCard(userId, cardId)
  const store = await loadCardStore()
  const entry = store.cards.find((item) => item.id === card.id)
  if (!entry) {
    throw new AuthError('Tarjeta no encontrada', 404)
  }
  entry.status = status
  await saveCardStore(store)
  return toPublicCard(entry)
}

async function requireOwnedCard(userId: string, cardId: string): Promise<StoredCard> {
  if (!cardId || RESERVED_IDS.has(cardId)) {
    throw new AuthError('Tarjeta no encontrada', 404)
  }
  const store = await loadCardStore()
  const card = store.cards.find((item) => item.id === cardId)
  if (!card) {
    throw new AuthError('Tarjeta no encontrada', 404)
  }
  if (card.userId !== userId) {
    throw new AuthError('No puedes ver esta tarjeta', 403)
  }
  return card
}

async function findCardByUser(userId: string): Promise<StoredCard | undefined> {
  const store = await loadCardStore()
  return store.cards.find((card) => card.userId === userId)
}

async function toPublicCard(card: StoredCard): Promise<PublicCard> {
  const spent = await spentLast24h(card.id)
  const remaining = Math.max(0, Number(card.dailyLimitUsd) - spent)
  const treasury = await peekTreasuryPublicKey()
  const available = await loadAssetBalance(card.publicKey, 'USDC')
  return {
    id: card.id,
    userId: card.userId,
    publicKey: card.publicKey,
    holderName: card.holderName,
    brand: card.brand,
    type: card.type,
    last4: card.last4,
    expMonth: card.expMonth,
    expYear: card.expYear,
    status: card.status,
    limits: {
      daily: {
        amount: Number(card.dailyLimitUsd).toFixed(2),
        spent: spent.toFixed(2),
        remaining: remaining.toFixed(2),
        currency: 'USD',
      },
    },
    balance: {
      available: trimAmount(available),
      currency: 'USDC',
    },
    settlementAccount: treasury,
    createdAt: card.createdAt,
  }
}

async function spentLast24h(cardId: string): Promise<number> {
  const store = await loadCardStore()
  const since = Date.now() - 24 * 60 * 60 * 1000
  return store.transactions
    .filter(
      (tx) =>
        tx.cardId === cardId &&
        tx.status === 'approved' &&
        Date.parse(tx.createdAt) >= since,
    )
    .reduce((sum, tx) => sum + Number(tx.amount), 0)
}

async function recordAuthorization(
  card: StoredCard,
  input: Omit<StoredCardTx, 'id' | 'cardId' | 'createdAt'>,
): Promise<CardAuthorization> {
  const tx: StoredCardTx = {
    id: `txn_${randomBytes(8).toString('hex')}`,
    cardId: card.id,
    createdAt: new Date().toISOString(),
    ...input,
  }
  const store = await loadCardStore()
  store.transactions.push(tx)
  await saveCardStore(store)
  return toAuthorization(tx)
}

function toAuthorization(tx: StoredCardTx): CardAuthorization {
  return {
    id: tx.id,
    cardId: tx.cardId,
    merchant: tx.merchant,
    amount: tx.amount,
    currency: tx.currency,
    status: tx.status,
    declineReason: tx.declineReason,
    declineCode: tx.declineCode,
    txHash: tx.txHash,
    stellarExpertUrl: tx.txHash ? stellarExpertTxUrl(tx.txHash) : undefined,
    createdAt: tx.createdAt,
  }
}

export function stellarExpertTxUrl(hash: string): string {
  const network =
    networkPassphrase() === Networks.PUBLIC ? 'public' : 'testnet'
  return `https://stellar.expert/explorer/${network}/tx/${hash}`
}

async function loadAssetBalance(
  publicKey: string,
  currency: string,
): Promise<number> {
  try {
    const server = new Horizon.Server(horizonUrl())
    const account = await server.loadAccount(publicKey)
    if (currency === 'XLM') {
      const native = account.balances.find((line) => line.asset_type === 'native')
      return native && 'balance' in native ? Number(native.balance) : 0
    }
    const asset = usdcAssetFromEnv()
    const line = account.balances.find((entry) => {
      if (entry.asset_type === 'native' || entry.asset_type === 'liquidity_pool_shares') {
        return false
      }
      return (
        entry.asset_code === asset.getCode() &&
        entry.asset_issuer === asset.getIssuer()
      )
    })
    return line && 'balance' in line ? Number(line.balance) : 0
  } catch {
    return 0
  }
}

async function peekTreasuryPublicKey(): Promise<string> {
  const envSecret = readEnv('CARD_TREASURY_SECRET_KEY')
  if (envSecret && StrKey.isValidEd25519SecretSeed(envSecret)) {
    return Keypair.fromSecret(envSecret).publicKey()
  }
  const store = await loadCardStore()
  return store.treasury?.publicKey ?? ''
}

async function ensureTreasury(): Promise<{ publicKey: string; secret: string }> {
  const envSecret = readEnv('CARD_TREASURY_SECRET_KEY')
  if (envSecret) {
    if (!StrKey.isValidEd25519SecretSeed(envSecret)) {
      throw new AuthError('CARD_TREASURY_SECRET_KEY no es una secret key válida', 500)
    }
    const pair = Keypair.fromSecret(envSecret)
    if (isTestnet()) {
      await ensureUsdcTrustline(envSecret)
    }
    return { publicKey: pair.publicKey(), secret: envSecret }
  }

  const store = await loadCardStore()
  if (store.treasury?.secretKeyEnc) {
    const secret = decryptField(store.treasury.secretKeyEnc)
    if (isTestnet()) {
      await ensureUsdcTrustline(secret)
    }
    return { publicKey: store.treasury.publicKey, secret }
  }

  const keys = isTestnet()
    ? await provisionStellarAccount()
    : (() => {
        const pair = Keypair.random()
        return { publicKey: pair.publicKey(), secretKey: pair.secret() }
      })()
  if (isTestnet()) {
    await ensureUsdcTrustline(keys.secretKey)
  }

  store.treasury = {
    publicKey: keys.publicKey,
    secretKeyEnc: encryptField(keys.secretKey),
  }
  await saveCardStore(store)
  return { publicKey: keys.publicKey, secret: keys.secretKey }
}

function generateVisaPan(): string {
  const body = `424242${randomDigits(9)}`
  return `${body}${luhnCheckDigit(body)}`
}

function generateCvv(): string {
  return randomDigits(3)
}

function randomDigits(length: number): string {
  const bytes = randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i += 1) {
    out += String((bytes[i] ?? 0) % 10)
  }
  return out
}

function luhnCheckDigit(digits: string): string {
  let sum = 0
  let shouldDouble = true
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let value = Number(digits[i])
    if (shouldDouble) {
      value *= 2
      if (value > 9) {
        value -= 9
      }
    }
    sum += value
    shouldDouble = !shouldDouble
  }
  return String((10 - (sum % 10)) % 10)
}

function holderNameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? 'TITULAR'
  const name = local
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim()
    .toUpperCase()
  return (name || 'TITULAR').slice(0, 26)
}

function dailyLimitFromEnv(): string {
  const raw = readEnv('CARD_DAILY_LIMIT_USD')
  const value = Number(raw || DEFAULT_DAILY_LIMIT)
  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_DAILY_LIMIT
  }
  return value.toFixed(2)
}

function normalizeCurrency(raw: string | undefined): string {
  const value = String(raw ?? 'USDC').trim().toUpperCase()
  if (value === 'USD') {
    return 'USDC'
  }
  if (value === 'USDC' || value === 'XLM') {
    return value
  }
  throw new AuthError('La moneda debe ser USDC o XLM', 400)
}

function trimAmount(value: number): string {
  if (!Number.isFinite(value)) {
    return '0'
  }
  return value.toFixed(7).replace(/\.?0+$/, '')
}

function readEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = String(process.env[key] ?? '')
      .replace(/^['"]+|['"]+$/g, '')
      .trim()
    if (value && !/ENTER_YOUR_/i.test(value)) {
      return value
    }
  }
  return ''
}
