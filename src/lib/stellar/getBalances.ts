import { Asset, type Horizon } from '@stellar/stellar-sdk'
import { getHorizonServer, stellarConfig } from './config'

export type AccountBalances = {
  xlm: string
  usdc: string
  loyalty: string
  raw: HorizonBalance[]
}

export type HorizonBalance = {
  assetType: string
  assetCode?: string
  assetIssuer?: string
  balance: string
}

export const EMPTY_BALANCES: AccountBalances = {
  xlm: '0',
  usdc: '0',
  loyalty: '0',
  raw: [],
}

type BalanceLine = Horizon.HorizonApi.BalanceLine

function isCredit(entry: BalanceLine): entry is Horizon.HorizonApi.BalanceLineAsset {
  return entry.asset_type !== 'native' && entry.asset_type !== 'liquidity_pool_shares'
}

function matchCredit(entry: BalanceLine, code: string, issuer: string): boolean {
  if (!issuer || !isCredit(entry)) {
    return false
  }
  return (
    entry.asset_code.toUpperCase() === code.toUpperCase() &&
    entry.asset_issuer === issuer
  )
}

function matchLoyaltyCode(entry: BalanceLine, code: string): boolean {
  return isCredit(entry) && entry.asset_code.toUpperCase() === code.toUpperCase()
}

function toRaw(entry: BalanceLine): HorizonBalance {
  if (isCredit(entry)) {
    return {
      assetType: entry.asset_type,
      assetCode: entry.asset_code,
      assetIssuer: entry.asset_issuer,
      balance: entry.balance,
    }
  }
  return { assetType: entry.asset_type, balance: entry.balance }
}

/**
 * Loads a Stellar account from Horizon and returns the balances shown in the
 * wallet: native XLM, configured USDC, and the loyalty points asset.
 * Missing trustlines resolve to "0". An unfunded account also returns zeros.
 */
export async function getBalances(publicKey: string): Promise<AccountBalances> {
  const server = getHorizonServer()

  try {
    const account = await server.loadAccount(publicKey)
    const raw = account.balances.map(toRaw)

    const xlm =
      account.balances.find((b) => b.asset_type === 'native')?.balance ?? '0'

    const usdc =
      account.balances.find((b) =>
        matchCredit(b, stellarConfig.usdc.code, stellarConfig.usdc.issuer),
      )?.balance ?? '0'

    const loyalty =
      account.balances.find((b) =>
        matchCredit(
          b,
          stellarConfig.loyalty.code,
          stellarConfig.loyalty.issuer,
        ),
      )?.balance ??
      account.balances.find((b) =>
        matchLoyaltyCode(b, stellarConfig.loyalty.code),
      )?.balance ??
      '0'

    return { xlm, usdc, loyalty, raw }
  } catch (error) {
    if (isNotFound(error)) {
      return { ...EMPTY_BALANCES, raw: [] }
    }
    throw error
  }
}

export function usdcAsset(): Asset {
  return new Asset(stellarConfig.usdc.code, stellarConfig.usdc.issuer)
}

export function loyaltyAsset(): Asset | null {
  if (!stellarConfig.loyalty.issuer) {
    return null
  }
  return new Asset(stellarConfig.loyalty.code, stellarConfig.loyalty.issuer)
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    (error as { response?: { status?: number } }).response?.status === 404
  )
}
