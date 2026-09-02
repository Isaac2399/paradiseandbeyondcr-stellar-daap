import type { PaymentQrPayload } from './qrPayload'

export type FeeBumpSubmitResult = {
  hash: string
  status: string
  rewardHash?: string
}

/**
 * Sends the payment through the backend, which signs with the custodial
 * keypair and optionally wraps a fee-bump if SPONSOR_SECRET_KEY is set.
 */
export async function confirmPaymentWithFeeBump(
  payload: PaymentQrPayload,
): Promise<FeeBumpSubmitResult> {
  const response = await fetch('/api/payments', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      destination: payload.destination,
      amount: payload.amount,
      asset: payload.asset,
      memo: payload.memo,
      reward: payload.reward ?? '',
    }),
  })

  const body = (await response.json()) as FeeBumpSubmitResult & { error?: string }
  if (!response.ok) {
    throw new Error(body.error ?? `El pago falló (${response.status})`)
  }
  if (!body.hash) {
    throw new Error('No se devolvió hash de transacción')
  }
  return body
}
