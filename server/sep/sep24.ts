import { AuthError } from '../errors.js'
import { authenticateSep10, readAnchorJson, anchorMessage, clearSep10Cache } from './sep10.js'
import { loadAnchorToml, type AnchorToml } from './toml.js'

export type Sep24Interactive = {
  id: string
  url: string
  type: string
}

export type Sep24Transaction = {
  id: string
  kind: string
  status: string
  status_eta?: number | null
  more_info_url?: string
  amount_in?: string
  amount_out?: string
  amount_in_asset?: string
  amount_out_asset?: string
  started_at?: string
  completed_at?: string | null
  stellar_transaction_id?: string | null
  external_transaction_id?: string | null
  message?: string | null
  memo?: string | null
}

export type Sep24AmountLimits = {
  min: number
  max: number
}

export async function getUsdcDepositLimits(): Promise<Sep24AmountLimits | null> {
  const toml = await loadAnchorToml()
  const response = await fetch(`${toml.transferServerSep24}/info`)
  const payload = await readAnchorJson(response)
  if (!response.ok) {
    return null
  }
  const deposit = payload.deposit as Record<string, unknown> | undefined
  const usdc = deposit?.USDC as Record<string, unknown> | undefined
  const min = Number(usdc?.min_amount)
  const max = Number(usdc?.max_amount)
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= 0) {
    return null
  }
  return { min, max }
}

export function parseSep24Amount(raw: string): string | undefined {
  const normalized = raw.trim().replace(',', '.')
  if (!normalized) {
    return undefined
  }
  if (!/^\d+(\.\d{1,7})?$/.test(normalized)) {
    throw new AuthError('El monto no es válido. Usa un número como 5 o 5.50', 400)
  }
  return normalized
}

export function assertAmountWithinLimits(
  amount: string,
  limits: Sep24AmountLimits | null,
): void {
  if (!limits) {
    return
  }
  const value = Number(amount)
  if (value < limits.min || value > limits.max) {
    throw new AuthError(
      `El ancla acepta entre ${formatLimit(limits.min)} y ${formatLimit(limits.max)} USDC. Prueba con ${suggestAmount(limits)}.`,
      400,
      'amount_out_of_range',
    )
  }
}

export function friendlyAnchorMessage(message: string, limits: Sep24AmountLimits | null): string {
  if (/maximum limit/i.test(message) || /exceeds/i.test(message)) {
    if (limits) {
      return `Ese monto supera el máximo del ancla (${formatLimit(limits.max)} USDC). Prueba con ${suggestAmount(limits)}.`
    }
    return 'Ese monto supera el máximo del ancla. Prueba con un valor más bajo, por ejemplo 5.'
  }
  if (/minimum/i.test(message) && limits) {
    return `El monto mínimo del ancla es ${formatLimit(limits.min)} USDC.`
  }
  return message
}

function formatLimit(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value)
}

function suggestAmount(limits: Sep24AmountLimits): string {
  const mid = Math.min(limits.max, Math.max(limits.min, 5))
  return formatLimit(mid)
}

export async function startInteractiveDeposit(input: {
  publicKey: string
  secretKey: string
  amount?: string
  lang?: string
}): Promise<{ interactive: Sep24Interactive; toml: AnchorToml }> {
  const limits = await getUsdcDepositLimits()
  if (input.amount) {
    assertAmountWithinLimits(input.amount, limits)
  }

  const { token, toml } = await authenticateSep10({
    publicKey: input.publicKey,
    secretKey: input.secretKey,
  })

  const fields: Record<string, string> = {
    asset_code: 'USDC',
    account: input.publicKey,
    lang: input.lang ?? 'es',
  }
  if (toml.usdcIssuer) {
    fields.asset_issuer = toml.usdcIssuer
  }
  if (input.amount) {
    fields.amount = input.amount
  }

  const response = await postInteractiveDeposit(
    `${toml.transferServerSep24}/transactions/deposit/interactive`,
    token,
    fields,
  )
  let payload = await readAnchorJson(response)
  if (response.status === 401) {
    clearSep10Cache(input.publicKey)
    const retryAuth = await authenticateSep10({
      publicKey: input.publicKey,
      secretKey: input.secretKey,
    })
    const retry = await postInteractiveDeposit(
      `${retryAuth.toml.transferServerSep24}/transactions/deposit/interactive`,
      retryAuth.token,
      fields,
    )
    payload = await readAnchorJson(retry)
    if (retry.status === 401) {
      throw new AuthError(
        'La sesión con el ancla expiró. Vuelve a iniciar el depósito.',
        401,
        'expired_session',
      )
    }
    if (!retry.ok) {
      throw new AuthError(
        friendlyAnchorMessage(
          anchorMessage(payload, 'No se pudo iniciar el depósito SEP-24'),
          limits,
        ),
        retry.status >= 500 ? 502 : 400,
        'sep24_interactive',
      )
    }
  } else if (!response.ok) {
    throw new AuthError(
      friendlyAnchorMessage(
        anchorMessage(payload, 'No se pudo iniciar el depósito SEP-24'),
        limits,
      ),
      response.status >= 500 ? 502 : 400,
      'sep24_interactive',
    )
  }

  const id = String(payload.id ?? '')
  const url = String(payload.url ?? '')
  if (!id || !url) {
    throw new AuthError('El ancla no devolvió URL interactiva de depósito', 502)
  }

  return {
    toml,
    interactive: {
      id,
      url,
      type: String(payload.type ?? 'interactive_customer_info_needed'),
    },
  }
}

async function postInteractiveDeposit(
  url: string,
  token: string,
  fields: Record<string, string>,
): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(fields),
  })
}

export async function getSep24Transaction(input: {
  publicKey: string
  secretKey: string
  id: string
}): Promise<Sep24Transaction> {
  const { token, toml } = await authenticateSep10({
    publicKey: input.publicKey,
    secretKey: input.secretKey,
  })

  const url = new URL(`${toml.transferServerSep24}/transaction`)
  url.searchParams.set('id', input.id)

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const payload = await readAnchorJson(response)
  if (response.status === 401) {
    clearSep10Cache(input.publicKey)
    throw new AuthError(
      'La sesión con el ancla expiró. Vuelve a consultar el depósito.',
      401,
      'expired_session',
    )
  }
  if (!response.ok) {
    throw new AuthError(
      anchorMessage(payload, 'No se pudo leer el estado del depósito'),
      response.status >= 500 ? 502 : 400,
    )
  }

  const tx = (payload.transaction ?? payload) as Record<string, unknown>
  return {
    id: String(tx.id ?? input.id),
    kind: String(tx.kind ?? 'deposit'),
    status: String(tx.status ?? 'unknown'),
    status_eta: typeof tx.status_eta === 'number' ? tx.status_eta : null,
    more_info_url: tx.more_info_url ? String(tx.more_info_url) : undefined,
    amount_in: tx.amount_in ? String(tx.amount_in) : undefined,
    amount_out: tx.amount_out ? String(tx.amount_out) : undefined,
    amount_in_asset: tx.amount_in_asset ? String(tx.amount_in_asset) : undefined,
    amount_out_asset: tx.amount_out_asset ? String(tx.amount_out_asset) : undefined,
    started_at: tx.started_at ? String(tx.started_at) : undefined,
    completed_at: tx.completed_at ? String(tx.completed_at) : null,
    stellar_transaction_id: tx.stellar_transaction_id
      ? String(tx.stellar_transaction_id)
      : null,
    external_transaction_id: tx.external_transaction_id
      ? String(tx.external_transaction_id)
      : null,
    message: tx.message ? String(tx.message) : null,
    memo: tx.memo ? String(tx.memo) : null,
  }
}
