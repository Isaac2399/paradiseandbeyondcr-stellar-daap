export type UserRole = 'customer' | 'merchant'

export type BusinessPlace = {
  name: string
  address: string
  lat: number
  lng: number
  category: string
  note?: string
}

export type AppUser = {
  id?: string
  email: string
  publicKey: string
  role: UserRole
  place?: BusinessPlace
}

export type PublicPlace = BusinessPlace & {
  id: string
}

export type PaymentAssetCode = 'XLM' | 'USDC' | string
