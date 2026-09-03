import { AuthError } from './errors.js'
import {
  isSuperAdminRecord,
  superAdminPublicKey,
  type PublicUser,
  type StoredUser,
} from './auth.js'
import { loadStore } from './userStore.js'
import { horizonUrl, loyaltyAssetFromEnv, usdcAssetFromEnv } from './provisionAccount.js'

export type AdminPayment = {
  id: string
  hash: string
  kind: 'sent' | 'received' | 'funded'
  amount: string
  asset: string
  counterparty: string
  memo: string
  createdAt: string
  status: 'success' | 'failed'
}

export type TokenTotals = Record<string, string>

export type AdminMerchantRow = {
  id: string
  email: string
  publicKey: string
  createdAt: string
  placeName?: string
  sales: TokenTotals
  receivedCount: number
}

export type AdminCustomerRow = {
  id: string
  email: string
  publicKey: string
  createdAt: string
  payments: AdminPayment[]
}

export type AdminOverview = {
  distributorPublicKey: string
  merchants: AdminMerchantRow[]
  customers: AdminCustomerRow[]
  merchantSalesTotal: TokenTotals
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

export async function requireSuperAdmin(session: PublicUser | null): Promise<PublicUser> {
  if (!session) {
    throw new AuthError('No hay sesión', 401)
  }
  if (session.role !== 'admin') {
    throw new AuthError('Solo el super admin puede ver este panel', 403)
  }
  return session
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const store = await loadStore()
  const merchants = store.users.filter(
    (user) => user.role === 'merchant' && !isSuperAdminRecord(user),
  )
  const customers = store.users.filter(
    (user) => user.role === 'customer' && !isSuperAdminRecord(user),
  )

  const merchantRows = await mapPool(merchants, 4, loadMerchantRow)
  const customerRows = await mapPool(customers, 4, loadCustomerRow)

  const merchantSalesTotal = emptySales()
  for (const row of merchantRows) {
    addTotals(merchantSalesTotal, row.sales)
  }

  return {
    distributorPublicKey: superAdminPublicKey(),
    merchants: merchantRows.sort((a, b) => a.email.localeCompare(b.email)),
    customers: customerRows.sort((a, b) => a.email.localeCompare(b.email)),
    merchantSalesTotal,
  }
}

async function loadMerchantRow(user: StoredUser): Promise<AdminMerchantRow> {
  const payments = await loadAccountPayments(user.publicKey, 200)
  const sales = emptySales()
  let receivedCount = 0
  for (const item of payments) {
    if (item.kind !== 'received' || item.status !== 'success') {
      continue
    }
    receivedCount += 1
    const asset = saleAsset(item.asset)
    sales[asset] = addAmounts(sales[asset] ?? '0', item.amount)
  }
  return {
    id: user.id,
    email: user.email,
    publicKey: user.publicKey,
    createdAt: user.createdAt,
    placeName: user.place?.name,
    sales,
    receivedCount,
  }
}

async function loadCustomerRow(user: StoredUser): Promise<AdminCustomerRow> {
  return {
    id: user.id,
    email: user.email,
    publicKey: user.publicKey,
    createdAt: user.createdAt,
    payments: await loadAccountPayments(user.publicKey, 50),
  }
}

async function loadAccountPayments(
  publicKey: string,
  limit: number,
): Promise<AdminPayment[]> {
  const url = new URL(
    `${horizonUrl()}/accounts/${encodeURIComponent(publicKey)}/payments`,
  )
  url.searchParams.set('order', 'desc')
  url.searchParams.set('limit', String(Math.min(limit, 200)))
  url.searchParams.set('join', 'transactions')

  try {
    const response = await fetch(url)
    if (response.status === 404) {
      return []
    }
    if (!response.ok) {
      return []
    }
    const page = (await response.json()) as {
      _embedded?: { records?: HorizonPaymentRecord[] }
    }
    return (page._embedded?.records ?? [])
      .map((record) => toPayment(record, publicKey))
      .filter((item): item is AdminPayment => item !== null)
  } catch {
    return []
  }
}

function toPayment(
  record: HorizonPaymentRecord,
  publicKey: string,
): AdminPayment | null {
  const failed =
    record.transaction?.successful === false ||
    record.transaction_successful === false
  const status = failed ? 'failed' : 'success'
  const createdAt = record.transaction?.created_at ?? record.created_at
  const memo = record.transaction?.memo ?? ''

  if (record.type === 'create_account') {
    const destination = record.account ?? ''
    const source = record.funder ?? ''
    const kind =
      source === publicKey ? 'sent' : destination === publicKey ? 'funded' : 'received'
    return {
      id: record.id,
      hash: record.transaction_hash,
      kind,
      amount: record.starting_balance ?? '0',
      asset: 'XLM',
      counterparty: kind === 'sent' ? destination : source,
      memo,
      createdAt,
      status,
    }
  }

  if (
    record.type !== 'payment' &&
    record.type !== 'path_payment_strict_send' &&
    record.type !== 'path_payment_strict_receive'
  ) {
    return null
  }

  const from = record.from ?? ''
  const to = record.to ?? ''
  const kind = from === publicKey ? 'sent' : 'received'
  const code =
    record.asset_type === 'native' ? 'XLM' : saleAsset(record.asset_code ?? 'TOKEN')

  return {
    id: record.id,
    hash: record.transaction_hash,
    kind,
    amount: record.amount ?? '0',
    asset: code,
    counterparty: kind === 'sent' ? to : from,
    memo,
    createdAt,
    status,
  }
}

function emptySales(): TokenTotals {
  return {
    XLM: '0',
    USDC: '0',
    [loyaltyCode()]: '0',
  }
}

function saleAsset(code: string): string {
  const upper = code.trim().toUpperCase()
  if (!upper || upper === 'NATIVE') {
    return 'XLM'
  }
  if (upper === 'USDC') {
    return usdcCode()
  }
  if (upper === loyaltyCode().toUpperCase()) {
    return loyaltyCode()
  }
  return upper
}

function usdcCode(): string {
  try {
    return usdcAssetFromEnv().getCode().toUpperCase() || 'USDC'
  } catch {
    return 'USDC'
  }
}

function loyaltyCode(): string {
  try {
    return loyaltyAssetFromEnv().getCode()
  } catch {
    return 'ROJOS'
  }
}

function addTotals(target: TokenTotals, extra: TokenTotals) {
  for (const [asset, amount] of Object.entries(extra)) {
    target[asset] = addAmounts(target[asset] ?? '0', amount)
  }
}

function addAmounts(left: string, right: string): string {
  const sum = Number(left) + Number(right)
  if (!Number.isFinite(sum)) {
    return left
  }
  return (Math.round(sum * 1e7) / 1e7).toString()
}

async function mapPool<T, R>(
  items: T[],
  size: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = []
  for (let index = 0; index < items.length; index += size) {
    const chunk = items.slice(index, index + size)
    out.push(...(await Promise.all(chunk.map(mapper))))
  }
  return out
}
