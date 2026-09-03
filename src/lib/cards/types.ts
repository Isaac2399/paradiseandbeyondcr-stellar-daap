export type CardStatus = 'active' | 'frozen' | 'canceled'

export type PublicCard = {
  id: string
  userId: string
  publicKey: string
  holderName: string
  brand: 'visa'
  type: 'virtual'
  last4: string
  expMonth: string
  expYear: string
  status: CardStatus
  limits: {
    daily: {
      amount: string
      spent: string
      remaining: string
      currency: 'USD'
    }
  }
  balance: {
    available: string
    currency: string
  }
  settlementAccount: string
  createdAt: string
}

export type SecureCardDetails = {
  pan: string
  cvv: string
  expMonth: string
  expYear: string
}

export type CardAuthorization = {
  id: string
  cardId: string
  merchant: string
  amount: string
  currency: string
  status: 'approved' | 'declined'
  declineReason?: string
  declineCode?: string
  txHash?: string
  stellarExpertUrl?: string
  createdAt: string
}
