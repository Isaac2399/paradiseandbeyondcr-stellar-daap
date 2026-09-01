import { AuthError } from '../errors.js'
import { authenticateSep10, readAnchorJson, anchorMessage, clearSep10Cache } from './sep10.js'
import type { AnchorToml } from './toml.js'

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

export async function startInteractiveDeposit(input: {
  publicKey: string
  secretKey: string
  amount?: string
  lang?: string
}): Promise<{ interactive: Sep24Interactive; toml: AnchorToml }> {
  const { token, toml } = await authenticateSep10({
    publicKey: input.publicKey,
    secretKey: input.secretKey,
  })

  const body = new URLSearchParams()
  body.set('asset_code', 'USDC')
  body.set('account', input.publicKey)
  body.set('lang', input.lang ?? 'es')
  if (toml.usdcIssuer) {
    body.set('asset_issuer', toml.usdcIssuer)
  }
  if (input.amount) {
    body.set('amount', input.amount)
  }

  const response = await fetch(
    `${toml.transferServerSep24}/transactions/deposit/interactive`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    },
  )
  let payload = await readAnchorJson(response)
  if (response.status === 401) {
    clearSep10Cache(input.publicKey)
    const retryAuth = await authenticateSep10({
      publicKey: input.publicKey,
      secretKey: input.secretKey,
    })
    const retry = await fetch(
      `${retryAuth.toml.transferServerSep24}/transactions/deposit/interactive`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${retryAuth.token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      },
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
        anchorMessage(payload, 'No se pudo iniciar el depósito SEP-24'),
        retry.status >= 500 ? 502 : 400,
        'sep24_interactive',
      )
    }
  } else if (!response.ok) {
    throw new AuthError(
      anchorMessage(payload, 'No se pudo iniciar el depósito SEP-24'),
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
