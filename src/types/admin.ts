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
