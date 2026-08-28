import { Horizon, Networks } from '@stellar/stellar-sdk'

/** Circle USDC on Stellar public network. Override via env for testnet. */
const MAINNET_USDC_ISSUER =
  'GA5ZSEJYB37JRC5RCJAELWUHTMYHMEKPVGFBMDLM5AH4VEKBE4SKZU7Z'

const PLACEHOLDER = /ENTER_YOUR_/i

function envValue(...keys: (keyof ImportMetaEnv)[]): string {
  for (const key of keys) {
    const value = import.meta.env[key]?.trim() ?? ''
    if (value && !PLACEHOLDER.test(value)) {
      return value
    }
  }
  return ''
}

function networkPassphrase(): string {
  const network = envValue(
    'VITE_STELLAR_NETWORK',
    'NEXT_PUBLIC_STELLAR_NETWORK',
  ).toUpperCase()
  if (network === 'PUBLIC') {
    return Networks.PUBLIC
  }
  return (
    envValue('VITE_NETWORK_PASSPHRASE') || Networks.TESTNET
  )
}

export const stellarConfig = {
  horizonUrl:
    envValue('VITE_HORIZON_URL', 'NEXT_PUBLIC_HORIZON_URL') ||
    'https://horizon-testnet.stellar.org',
  networkPassphrase: networkPassphrase(),
  usdc: {
    code: envValue('VITE_USDC_CODE') || 'USDC',
    issuer: envValue('VITE_USDC_ISSUER') || MAINNET_USDC_ISSUER,
  },
  loyalty: {
    code: envValue('VITE_LOYALTY_CODE', 'NEXT_PUBLIC_LOYALTY_CODE') || 'PUNTOS',
    issuer: envValue('VITE_LOYALTY_ISSUER', 'NEXT_PUBLIC_LOYALTY_ISSUER'),
  },
  feeBumpApiUrl: envValue('VITE_FEE_BUMP_API_URL') || '/api/fee-bump',
  pointsPerUsdc: Number(envValue('VITE_POINTS_PER_USDC') || '10'),
  pointsPerXlm: Number(envValue('VITE_POINTS_PER_XLM') || '1'),
}

let horizon: Horizon.Server | null = null

export function getHorizonServer(): Horizon.Server {
  horizon ??= new Horizon.Server(stellarConfig.horizonUrl)
  return horizon
}
