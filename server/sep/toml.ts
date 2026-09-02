import { AuthError } from '../errors.js'

export type AnchorToml = {
  homeDomain: string
  signingKey: string
  webAuthEndpoint: string
  transferServerSep24: string
  networkPassphrase: string
  usdcIssuer: string
}

const PLACEHOLDER = /ENTER_YOUR_/i

export function sep24HomeDomain(): string {
  const raw =
    readEnv('SEP24_HOME_DOMAIN', 'VITE_SEP24_HOME_DOMAIN') ||
    'testanchor.stellar.org'
  return raw.replace(/^https?:\/\//i, '').replace(/\/$/, '')
}

export function sep24ClientDomain(): string {
  return readEnv('SEP24_CLIENT_DOMAIN').replace(/^https?:\/\//i, '').replace(/\/$/, '')
}

export function sep24ClientSigningSecret(): string {
  return readEnv('SEP24_CLIENT_SIGNING_SECRET')
}

export async function loadAnchorToml(homeDomain = sep24HomeDomain()): Promise<AnchorToml> {
  const url = `https://${homeDomain}/.well-known/stellar.toml`
  let response: Response
  try {
    response = await fetch(url)
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'red'
    throw new AuthError(`No se pudo leer stellar.toml del ancla: ${detail}`, 502)
  }
  if (!response.ok) {
    throw new AuthError(
      `No se pudo leer stellar.toml del ancla (${response.status})`,
      502,
    )
  }
  const text = await response.text()
  const scalars = parseTomlScalars(text)
  const usdc = findCurrency(text, 'USDC')
  const webAuth = trimSlash(scalars.WEB_AUTH_ENDPOINT ?? '')
  const transfer =
    trimSlash(scalars.TRANSFER_SERVER_SEP0024 ?? '') ||
    trimSlash(scalars.TRANSFER_SERVER ?? '')
  if (!webAuth || !transfer) {
    throw new AuthError(
      'El stellar.toml del ancla no declara SEP-10 / SEP-24',
      502,
    )
  }
  return {
    homeDomain,
    signingKey: scalars.SIGNING_KEY ?? '',
    webAuthEndpoint: webAuth,
    transferServerSep24: transfer,
    networkPassphrase: scalars.NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015',
    usdcIssuer: usdc?.issuer ?? '',
  }
}

export function parseTomlScalars(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('[')) {
      continue
    }
    const eq = trimmed.indexOf('=')
    if (eq < 1) {
      continue
    }
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (value.startsWith('[')) {
      continue
    }
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

export function findCurrency(
  text: string,
  code: string,
): { code: string; issuer: string } | null {
  const blocks = text.split(/\[\[CURRENCIES\]\]/i).slice(1)
  for (const block of blocks) {
    const section = block.split('[')[0] ?? block
    const scalars = parseTomlScalars(section)
    if (scalars.code?.toUpperCase() === code.toUpperCase()) {
      return { code: scalars.code, issuer: scalars.issuer ?? '' }
    }
  }
  return null
}

function trimSlash(value: string): string {
  return value.replace(/\/$/, '')
}

function readEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = String(process.env[key] ?? '')
      .replace(/^['"]+|['"]+$/g, '')
      .trim()
    if (value && !PLACEHOLDER.test(value)) {
      return value
    }
  }
  return ''
}
