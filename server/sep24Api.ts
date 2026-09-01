import { AuthError } from './errors.js'
import { secretKeyForUser, type PublicUser } from './auth.js'
import {
  accountHasUsdcTrustline,
  ensureUsdcTrustline,
} from './provisionAccount.js'
import { startInteractiveDeposit, getSep24Transaction } from './sep/sep24.js'

export async function handleSep24Deposit(
  user: PublicUser,
  body: Record<string, unknown>,
) {
  const secretKey = await secretKeyForUser(user.id)
  const hasTrust = await accountHasUsdcTrustline(user.publicKey).catch(() => false)
  if (!hasTrust) {
    throw new AuthError(
      'Falta la trustline de USDC. Ábrela antes de depositar con el ancla.',
      409,
      'missing_trustline',
    )
  }

  const amountRaw = String(body.amount ?? '').trim()
  const amount = amountRaw && /^\d+(\.\d{1,7})?$/.test(amountRaw) ? amountRaw : undefined

  const { interactive, toml } = await startInteractiveDeposit({
    publicKey: user.publicKey,
    secretKey,
    amount,
  })

  return {
    id: interactive.id,
    url: interactive.url,
    type: interactive.type,
    homeDomain: toml.homeDomain,
    assetCode: 'USDC',
  }
}

export async function handleSep24Transaction(
  user: PublicUser,
  body: Record<string, unknown>,
) {
  const id = String(body.id ?? '').trim()
  if (!id) {
    throw new AuthError('Falta el id de la transacción SEP-24', 400)
  }
  const secretKey = await secretKeyForUser(user.id)
  const transaction = await getSep24Transaction({
    publicKey: user.publicKey,
    secretKey,
    id,
  })
  return { transaction }
}

export async function handleSep24Trustline(user: PublicUser) {
  const secretKey = await secretKeyForUser(user.id)
  await ensureUsdcTrustline(secretKey)
  return { ok: true, assetCode: 'USDC' }
}
