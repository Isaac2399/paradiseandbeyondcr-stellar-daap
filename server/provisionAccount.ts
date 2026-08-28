import {
  Asset,
  Horizon,
  Keypair,
  Networks,
  Operation,
  StrKey,
  TransactionBuilder,
} from '@stellar/stellar-sdk'

const FRIENDBOT_URL = 'https://friendbot.stellar.org'
const PLACEHOLDER = /ENTER_YOUR_/i

export async function provisionStellarAccount(): Promise<{
  publicKey: string
  secretKey: string
}> {
  const pair = Keypair.random()
  const publicKey = pair.publicKey()
  const secretKey = pair.secret()

  if (isTestnet()) {
    await fundWithFriendbot(publicKey)
  }

  await openLoyaltyTrustline(pair)

  return { publicKey, secretKey }
}

export function isTestnet(): boolean {
  const network = (process.env.VITE_STELLAR_NETWORK ??
    process.env.NEXT_PUBLIC_STELLAR_NETWORK ??
    'TESTNET')
    .trim()
    .toUpperCase()
  if (network === 'PUBLIC') {
    return false
  }
  return networkPassphrase() === Networks.TESTNET
}

export function networkPassphrase(): string {
  return (
    process.env.VITE_NETWORK_PASSPHRASE ??
    (isPublicNetwork() ? Networks.PUBLIC : Networks.TESTNET)
  )
}

function isPublicNetwork(): boolean {
  const network = (
    process.env.VITE_STELLAR_NETWORK ??
    process.env.NEXT_PUBLIC_STELLAR_NETWORK ??
    ''
  )
    .trim()
    .toUpperCase()
  return network === 'PUBLIC'
}

export function horizonUrl(): string {
  return (
    process.env.VITE_HORIZON_URL ??
    process.env.NEXT_PUBLIC_HORIZON_URL ??
    'https://horizon-testnet.stellar.org'
  )
}

export function loyaltyAssetFromEnv(): Asset | null {
  const code = readEnv(
    'VITE_LOYALTY_CODE',
    'NEXT_PUBLIC_LOYALTY_CODE',
  )
  const issuer = readEnv(
    'VITE_LOYALTY_ISSUER',
    'NEXT_PUBLIC_LOYALTY_ISSUER',
  )

  if (!code || !issuer) {
    return null
  }
  if (!StrKey.isValidEd25519PublicKey(issuer)) {
    throw new Error(
      'LOYALTY_ISSUER no es una public key de Stellar válida. Revisa .env.local.',
    )
  }
  return new Asset(code, issuer)
}

async function fundWithFriendbot(publicKey: string) {
  const url = `${FRIENDBOT_URL}?addr=${encodeURIComponent(publicKey)}`
  const response = await fetch(url)
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(
      `Friendbot no pudo activar la cuenta (${response.status}): ${detail.slice(0, 180)}`,
    )
  }
}

async function openLoyaltyTrustline(pair: Keypair) {
  let asset: Asset | null
  try {
    asset = loyaltyAssetFromEnv()
  } catch (error) {
    throw error
  }

  if (!asset) {
    console.warn(
      '[stellar] Trustline de lealtad omitida: define VITE_LOYALTY_CODE y VITE_LOYALTY_ISSUER en .env.local',
    )
    return
  }

  try {
    const server = new Horizon.Server(horizonUrl())
    const account = await server.loadAccount(pair.publicKey())
    const fee = String(await server.fetchBaseFee())
    const transaction = new TransactionBuilder(account, {
      fee,
      networkPassphrase: networkPassphrase(),
    })
      .addOperation(Operation.changeTrust({ asset }))
      .setTimeout(60)
      .build()

    transaction.sign(pair)
    const result = await server.submitTransaction(transaction)
    if (!result.successful && result.successful !== undefined) {
      throw new Error('Horizon rechazó la trustline del token de lealtad')
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'error de red'
    throw new Error(
      `No se pudo abrir la trustline de ${asset.getCode()}: ${detail}`,
    )
  }
}

function readEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim() ?? ''
    if (value && !PLACEHOLDER.test(value)) {
      return value
    }
  }
  return ''
}
