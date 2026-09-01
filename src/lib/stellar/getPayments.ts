import { stellarConfig } from './config'

export type ActivityKind = 'sent' | 'received' | 'funded'

export type AccountActivity = {
  id: string
  hash: string
  kind: ActivityKind
  amount: string
  asset: string
  counterparty: string
  memo: string
  createdAt: string
  status: 'success' | 'failed'
}

type HorizonPaymentRecord = {
  id: string
  type: string
  from?: string
  to?: string
  account?: string
  funder?: string
  amount?: string
  starting_balance?: string
  asset_type?: string
  asset_code?: string
  created_at: string
  transaction_hash: string
  transaction_successful?: boolean
  transaction?: {
    memo?: string
    memo_type?: string
    successful?: boolean
    created_at?: string
  }
}

type PaymentsPage = {
  _embedded?: { records?: HorizonPaymentRecord[] }
}

export async function getRecentPayments(
  publicKey: string,
  signal?: AbortSignal,
): Promise<AccountActivity[]> {
  const url = new URL(
    `${stellarConfig.horizonUrl}/accounts/${encodeURIComponent(publicKey)}/payments`,
  )
  url.searchParams.set('order', 'desc')
  url.searchParams.set('limit', '20')
  url.searchParams.set('join', 'transactions')

  const response = await fetch(url, { signal })
  if (response.status === 404) {
    return []
  }
  if (!response.ok) {
    throw new Error('No se pudo leer el historial de Horizon')
  }

  const page = (await response.json()) as PaymentsPage
  const records = page._embedded?.records ?? []

  return records
    .map((record) => toActivity(record, publicKey))
    .filter((item): item is AccountActivity => item !== null)
}

function toActivity(
  record: HorizonPaymentRecord,
  publicKey: string,
): AccountActivity | null {
  if (record.type === 'create_account') {
    const destination = record.account ?? ''
    const source = record.funder ?? ''
    const kind: ActivityKind =
      source === publicKey ? 'sent' : destination === publicKey ? 'funded' : 'received'
    return {
      id: record.id,
      hash: record.transaction_hash,
      kind,
      amount: record.starting_balance ?? '0',
      asset: 'XLM',
      counterparty: kind === 'sent' ? destination : source,
      memo: record.transaction?.memo ?? '',
      createdAt: record.transaction?.created_at ?? record.created_at,
      status:
        record.transaction?.successful === false ||
        record.transaction_successful === false
          ? 'failed'
          : 'success',
    }
  }

  if (record.type !== 'payment' && record.type !== 'path_payment_strict_send' && record.type !== 'path_payment_strict_receive') {
    return null
  }

  const from = record.from ?? ''
  const to = record.to ?? ''
  const kind: ActivityKind = from === publicKey ? 'sent' : 'received'

  return {
    id: record.id,
    hash: record.transaction_hash,
    kind,
    amount: record.amount ?? '0',
    asset: record.asset_type === 'native' ? 'XLM' : (record.asset_code ?? 'TOKEN'),
    counterparty: kind === 'sent' ? to : from,
    memo: record.transaction?.memo ?? '',
    createdAt: record.transaction?.created_at ?? record.created_at,
    status:
      record.transaction?.successful === false ||
      record.transaction_successful === false
        ? 'failed'
        : 'success',
  }
}
