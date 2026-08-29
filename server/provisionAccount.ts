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
    await waitForAccount(publicKey)
  }

  await ensureLoyaltyTrustline(secretKey)

  return { publicKey, secretKey }
}

export async function ensureLoyaltyTrustline(secretKey: string): Promise<void> {
  const asset = loyaltyAssetFromEnv()

  const pair = Keypair.fromSecret(secretKey)
  const server = new Horizon.Server(horizonUrl())
  const account = await waitForAccount(pair.publicKey())

  if (hasTrustline(account, asset)) {
    return
  }

  const fee = String(await server.fetchBaseFee())
  const transaction = new TransactionBuilder(account, {
    fee,
    networkPassphrase: networkPassphrase(),
  })
    .addOperation(Operation.changeTrust({ asset }))
    .setTimeout(60)
    .build()

  transaction.sign(pair)

  try {
    const result = await server.submitTransaction(transaction)
    if (!result.successful && result.successful !== undefined) {
      throw new Error('Horizon rechazó la trustline del token de lealtad')
    }
  } catch (error) {
    if (isAlreadyTrustedError(error)) {
      return
    }
    const detail = error instanceof Error ? error.message : 'error de red'
    throw new Error(`No se pudo abrir la trustline de ${asset.getCode()}: ${detail}`)
  }
}

export function isTestnet(): boolean {
  const network = readEnv(
    'VITE_STELLAR_NETWORK',
    'NEXT_PUBLIC_STELLAR_NETWORK',
  ).toUpperCase()
  if (network === 'PUBLIC') {
    return false
  }
  return networkPassphrase() === Networks.TESTNET
}

export function networkPassphrase(): string {
  return (
    readEnv('VITE_NETWORK_PASSPHRASE') ||
    (isPublicNetwork() ? Networks.PUBLIC : Networks.TESTNET)
  )
}

function isPublicNetwork(): boolean {
  return (
    readEnv(
      'VITE_STELLAR_NETWORK',
      'NEXT_PUBLIC_STELLAR_NETWORK',
    ).toUpperCase() === 'PUBLIC'
  )
}

export function horizonUrl(): string {
  return (
    readEnv('VITE_HORIZON_URL', 'NEXT_PUBLIC_HORIZON_URL') ||
    'https://horizon-testnet.stellar.org'
  )
}

export function loyaltyAssetFromEnv(): Asset {
  const code =
    readEnv(
      'LOYALTY_CODE',
      'VITE_LOYALTY_CODE',
      'NEXT_PUBLIC_LOYALTY_CODE',
    ) || 'ROJOS'
  const issuer =
    readEnv(
      'LOYALTY_ISSUER',
      'VITE_LOYALTY_ISSUER',
      'NEXT_PUBLIC_LOYALTY_ISSUER',
    ) || 'GBSLP3N4R65KVUYBAKQL5XAU67ZFGTNO3WBXJXWGDCH5FM3TFBNKXPPW'

  if (!StrKey.isValidEd25519PublicKey(issuer)) {
    throw new Error(
      'LOYALTY_ISSUER no es una public key de Stellar válida.',
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

async function waitForAccount(publicKey: string): Promise<Horizon.AccountResponse> {
  const server = new Horizon.Server(horizonUrl())
  let lastError: unknown
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      return await server.loadAccount(publicKey)
    } catch (error) {
      lastError = error
      await sleep(400 * (attempt + 1))
    }
  }
  const detail = lastError instanceof Error ? lastError.message : 'timeout'
  throw new Error(`Horizon no encontró la cuenta nueva: ${detail}`)
}

function hasTrustline(account: Horizon.AccountResponse, asset: Asset): boolean {
  return account.balances.some((entry) => {
    if (entry.asset_type === 'native' || entry.asset_type === 'liquidity_pool_shares') {
      return false
    }
    return entry.asset_code === asset.getCode() && entry.asset_issuer === asset.getIssuer()
  })
}

function isAlreadyTrustedError(error: unknown): boolean {
  const extras = (
    error as {
      response?: { data?: { extras?: { result_codes?: { operations?: string[] } } } }
    }
  ).response?.data?.extras?.result_codes?.operations
  return extras?.includes('op_already_exists') === true
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function readEnv(...keys: string[]): string {
  const env = process.env
  for (const key of keys) {
    const value = String(env[key] ?? '').trim()
    if (value && !PLACEHOLDER.test(value)) {
      return value
    }
  }
  return ''
}
