import {
  Asset,
  Horizon,
  Keypair,
  Memo,
  Operation,
  StrKey,
  TransactionBuilder,
} from '@stellar/stellar-sdk'
import { AuthError, secretKeyForUser } from './auth.ts'
import {
  horizonUrl,
  loyaltyAssetFromEnv,
  networkPassphrase,
} from './provisionAccount.ts'

export async function submitCustodialPayment(input: {
  userId: string
  destination: string
  amount: string
  asset: string
  memo?: string
}): Promise<{ hash: string; status: string }> {
  if (!StrKey.isValidEd25519PublicKey(input.destination)) {
    throw new AuthError('La cuenta destino no es válida', 400)
  }
  if (!/^\d+(\.\d{1,7})?$/.test(input.amount) || Number(input.amount) <= 0) {
    throw new AuthError('El monto no es válido', 400)
  }

  const source = Keypair.fromSecret(await secretKeyForUser(input.userId))
  const asset = resolveAsset(input.asset)
  const server = new Horizon.Server(horizonUrl())
  const account = await server.loadAccount(source.publicKey())
  const passphrase = networkPassphrase()
  const sponsor = sponsorKeypair()
  const baseFee = String(await server.fetchBaseFee())

  const builder = new TransactionBuilder(account, {
    fee: sponsor ? '0' : baseFee,
    networkPassphrase: passphrase,
  }).addOperation(
    Operation.payment({
      destination: input.destination,
      asset,
      amount: input.amount,
    }),
  )

  if (input.memo) {
    builder.addMemo(Memo.text(input.memo.slice(0, 28)))
  }

  const inner = builder.setTimeout(180).build()
  inner.sign(source)

  try {
    if (sponsor) {
      const feeBump = TransactionBuilder.buildFeeBumpTransaction(
        sponsor,
        baseFee,
        inner,
        passphrase,
      )
      feeBump.sign(sponsor)
      const result = await server.submitTransaction(feeBump)
      return { hash: result.hash, status: 'success' }
    }

    const result = await server.submitTransaction(inner)
    return { hash: result.hash, status: 'success' }
  } catch (error) {
    throw new AuthError(horizonPaymentMessage(error), 400)
  }
}

function resolveAsset(code: string): Asset {
  const normalized = code.trim().toUpperCase()
  if (normalized === 'XLM' || normalized === 'NATIVE') {
    return Asset.native()
  }
  if (normalized === 'USDC') {
    const issuer =
      process.env.VITE_USDC_ISSUER ??
      'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
    return new Asset('USDC', issuer)
  }

  const loyalty = loyaltyAssetFromEnv()
  if (loyalty && normalized === loyalty.getCode().toUpperCase()) {
    return loyalty
  }

  throw new AuthError(`Asset no soportado: ${code}`, 400)
}

function sponsorKeypair(): Keypair | null {
  const secret = process.env.SPONSOR_SECRET_KEY?.trim() ?? ''
  if (!secret || /ENTER_YOUR_/i.test(secret)) {
    return null
  }
  if (!StrKey.isValidEd25519SecretSeed(secret)) {
    return null
  }
  return Keypair.fromSecret(secret)
}

function horizonPaymentMessage(error: unknown): string {
  const extras = (
    error as {
      response?: {
        data?: {
          extras?: { result_codes?: { operations?: string[]; transaction?: string } }
          title?: string
        }
      }
    }
  ).response?.data

  const op = extras?.extras?.result_codes?.operations?.[0]
  if (op === 'op_no_trust') {
    return 'El destino no tiene trustline del token. La cuenta empresa debe haberse registrado con ROJOS configurado.'
  }
  if (op === 'op_underfunded') {
    return 'Saldo insuficiente para este pago.'
  }
  if (op === 'op_no_source_trust') {
    return 'Tu cuenta no tiene trustline de este token.'
  }
  if (op === 'op_line_full') {
    return 'El comercio no puede recibir más de este asset (línea llena).'
  }

  const title = extras?.title
  const tx = extras?.extras?.result_codes?.transaction
  if (op || tx || title) {
    return `El pago fue rechazado: ${op ?? tx ?? title}`
  }
  return error instanceof Error ? error.message : 'No se pudo enviar el pago'
}
