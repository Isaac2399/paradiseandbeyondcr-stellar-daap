export type UserRole = 'customer' | 'merchant'

export type AppUser = {
  id?: string
  email: string
  publicKey: string
  role: UserRole
}

export type PaymentAssetCode = 'XLM' | 'USDC' | string
