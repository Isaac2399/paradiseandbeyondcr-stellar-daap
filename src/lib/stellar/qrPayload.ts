import { StrKey } from '@stellar/stellar-sdk'
import type { PaymentAssetCode } from '../../types/user'
import { stellarConfig } from './config'

export const QR_PAYLOAD_VERSION = 1 as const

export type PaymentQrPayload = {
  version: typeof QR_PAYLOAD_VERSION
  destination: string
  amount: string
  asset: PaymentAssetCode
  memo: string
  /** Optional ROJOS gift from the merchant, deducted from their balance. */
  reward?: string
  assetIssuer?: string
}

const SEP7_SCHEME = 'web+stellar:pay'
const COMPACT_PREFIX = 'SP1|'

export class QrPayloadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'QrPayloadError'
  }
}

export function loyaltyAssetCode(): string {
  return stellarConfig.loyalty.code.toUpperCase()
}

export function isLoyaltyAsset(asset: string): boolean {
  return asset.trim().toUpperCase() === loyaltyAssetCode()
}

export function paymentAssetOptions(): { value: PaymentAssetCode; label: string }[] {
  const options: { value: PaymentAssetCode; label: string }[] = [
    { value: 'USDC', label: 'USDC' },
    { value: 'XLM', label: 'XLM' },
  ]
  if (stellarConfig.loyalty.issuer) {
    options.unshift({
      value: loyaltyAssetCode(),
      label: loyaltyAssetCode(),
    })
  }
  return options
}

export function serializePaymentPayload(input: {
  destination: string
  amount: string
  asset: PaymentAssetCode
  memo: string
  reward?: string
}): { json: string; uri: string; qr: string; payload: PaymentQrPayload } {
  const payload = normalizePayload({
    version: QR_PAYLOAD_VERSION,
    destination: input.destination,
    amount: input.amount,
    asset: input.asset,
    memo: input.memo,
    reward: input.reward,
  })

  return {
    payload,
    json: JSON.stringify(payload),
    uri: toSep7Uri(payload),
    qr: toCompactQr(payload),
  }
}

export function deserializePaymentPayload(raw: string): PaymentQrPayload {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new QrPayloadError('El QR está vacío')
  }

  if (trimmed.startsWith(COMPACT_PREFIX)) {
    return fromCompactQr(trimmed)
  }

  if (trimmed.startsWith(SEP7_SCHEME) || trimmed.startsWith('stellar:pay')) {
    return fromSep7Uri(trimmed)
  }

  try {
    const parsed: unknown = JSON.parse(trimmed)
    return normalizePayload(parsed)
  } catch (error) {
    if (error instanceof QrPayloadError) {
      throw error
    }
    throw new QrPayloadError('El QR no contiene un pago Stellar válido')
  }
}

export function toCompactQr(payload: PaymentQrPayload): string {
  const parts = [
    'SP1',
    payload.destination,
    payload.amount,
    payload.asset,
    encodeURIComponent(payload.memo),
  ]
  if (payload.reward) {
    parts.push(payload.reward)
  }
  return parts.join('|')
}

function fromCompactQr(raw: string): PaymentQrPayload {
  const parts = raw.split('|')
  if (parts.length < 4) {
    throw new QrPayloadError('QR compacto incompleto')
  }
  return normalizePayload({
    destination: parts[1],
    amount: parts[2],
    asset: parts[3],
    memo: decodeURIComponent(parts[4] ?? ''),
    reward: parts[5] ?? '',
  })
}

function allowedAssets(): Set<string> {
  const allowed = new Set(['XLM', 'USDC'])
  if (stellarConfig.loyalty.issuer) {
    allowed.add(loyaltyAssetCode())
  }
  return allowed
}

function normalizePayload(value: unknown): PaymentQrPayload {
  if (!isRecord(value)) {
    throw new QrPayloadError('Payload de pago inválido')
  }

  const destination = String(value.destination ?? '').trim()
  const amount = String(value.amount ?? '').trim()
  const asset = String(value.asset ?? '').trim().toUpperCase()
  const memo = String(value.memo ?? '').trim()
  const rewardRaw = String(value.reward ?? '').trim()

  if (!StrKey.isValidEd25519PublicKey(destination)) {
    throw new QrPayloadError('La public key de destino no es válida')
  }
  if (!isPositiveAmount(amount)) {
    throw new QrPayloadError('El monto debe ser un número mayor a 0')
  }
  if (!allowedAssets().has(asset)) {
    throw new QrPayloadError(
      `El asset debe ser ${[...allowedAssets()].join(', ')}`,
    )
  }
  if (isLoyaltyAsset(asset) && !stellarConfig.loyalty.issuer) {
    throw new QrPayloadError('El token de lealtad no está configurado')
  }
  if (byteLength(memo) > 28) {
    throw new QrPayloadError('El memo no puede superar 28 bytes (MEMO_TEXT)')
  }
  if (rewardRaw && !isPositiveAmount(rewardRaw)) {
    throw new QrPayloadError('La cantidad de puntos de regalo no es válida')
  }

  const payload: PaymentQrPayload = {
    version: QR_PAYLOAD_VERSION,
    destination,
    amount: formatAmount(amount),
    asset,
    memo,
  }
  if (rewardRaw) {
    payload.reward = formatAmount(rewardRaw)
  }

  if (asset === 'USDC') {
    payload.assetIssuer = stellarConfig.usdc.issuer
  }
  if (isLoyaltyAsset(asset)) {
    payload.assetIssuer = stellarConfig.loyalty.issuer
  }

  return payload
}

function toSep7Uri(payload: PaymentQrPayload): string {
  const params = new URLSearchParams()
  params.set('destination', payload.destination)
  params.set('amount', payload.amount)
  if (payload.memo) {
    params.set('memo', payload.memo)
    params.set('memo_type', 'MEMO_TEXT')
  }
  if (payload.asset === 'USDC') {
    params.set('asset_code', stellarConfig.usdc.code)
    params.set('asset_issuer', stellarConfig.usdc.issuer)
  }
  if (isLoyaltyAsset(payload.asset) && stellarConfig.loyalty.issuer) {
    params.set('asset_code', stellarConfig.loyalty.code)
    params.set('asset_issuer', stellarConfig.loyalty.issuer)
  }
  if (payload.reward) {
    params.set('reward', payload.reward)
  }
  return `${SEP7_SCHEME}?${params.toString()}`
}

function fromSep7Uri(uri: string): PaymentQrPayload {
  const queryIndex = uri.indexOf('?')
  if (queryIndex === -1) {
    throw new QrPayloadError('URI de pago Stellar incompleta')
  }

  const params = new URLSearchParams(uri.slice(queryIndex + 1))
  const assetCode = (params.get('asset_code') ?? 'XLM').toUpperCase()

  return normalizePayload({
    version: QR_PAYLOAD_VERSION,
    destination: params.get('destination'),
    amount: params.get('amount'),
    asset: assetCode,
    memo: params.get('memo') ?? '',
    reward: params.get('reward') ?? '',
  })
}

function isPositiveAmount(amount: string): boolean {
  return /^\d+(\.\d{1,7})?$/.test(amount) && Number(amount) > 0
}

function formatAmount(amount: string): string {
  const [whole, fraction = ''] = amount.split('.')
  if (!fraction) {
    return whole
  }
  return `${whole}.${fraction.replace(/0+$/, '')}`.replace(/\.$/, '')
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
