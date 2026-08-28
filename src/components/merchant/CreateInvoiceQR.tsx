import { useState, type FormEvent } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  paymentAssetOptions,
  serializePaymentPayload,
} from '@/lib/stellar/qrPayload'
import { stellarConfig } from '@/lib/stellar/config'
import type { PaymentAssetCode } from '@/types/user'

type CreateInvoiceQRProps = {
  merchantPublicKey: string
}

export function CreateInvoiceQR({ merchantPublicKey }: CreateInvoiceQRProps) {
  const assetOptions = paymentAssetOptions()
  const [amount, setAmount] = useState('10.00')
  const [asset, setAsset] = useState<PaymentAssetCode>(
    assetOptions[0]?.value ?? 'USDC',
  )
  const [memo, setMemo] = useState('ORD-1234')
  const [error, setError] = useState<string | null>(null)
  const [payloadText, setPayloadText] = useState<string | null>(null)

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    try {
      const encoded = serializePaymentPayload({
        destination: merchantPublicKey,
        amount,
        asset,
        memo,
      })
      setPayloadText(encoded.qr)
    } catch (err) {
      setPayloadText(null)
      setError(err instanceof Error ? err.message : 'No se pudo generar el QR')
    }
  }

  return (
    <div className="space-y-4">
      {!stellarConfig.loyalty.issuer ? (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Configura el issuer de {stellarConfig.loyalty.code} en .env.local para
          cobrar con ese token.
        </p>
      ) : null}

      <form className="grid gap-3" onSubmit={onSubmit}>
        <label className="grid gap-1 text-sm font-medium">
          Monto
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 font-normal"
            inputMode="decimal"
            name="amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="10.00"
            required
          />
        </label>

        <label className="grid gap-1 text-sm font-medium">
          Moneda
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 font-normal"
            name="asset"
            value={asset}
            onChange={(e) => setAsset(e.target.value as PaymentAssetCode)}
          >
            {assetOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm font-medium">
          Concepto / Memo
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 font-normal"
            name="memo"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="ORD-1234"
            maxLength={28}
          />
        </label>

        <button
          type="submit"
          className="rounded-xl bg-blue-600 text-white py-2.5 text-sm font-medium hover:bg-blue-700"
        >
          Generar QR
        </button>
      </form>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {payloadText ? (
        <div className="grid justify-items-center gap-3">
          <QRCodeSVG value={payloadText} size={280} level="M" includeMargin />
          <pre className="w-full overflow-auto text-xs bg-slate-50 p-3 rounded-lg">
            {payloadText}
          </pre>
        </div>
      ) : null}
    </div>
  )
}
