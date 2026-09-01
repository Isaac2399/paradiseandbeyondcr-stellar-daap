import { useState, type FormEvent } from 'react'
import { StrKey } from '@stellar/stellar-sdk'
import { Send } from 'lucide-react'
import { confirmPaymentWithFeeBump } from '@/lib/stellar/feeBump'
import { paymentAssetOptions } from '@/lib/stellar/qrPayload'
import type { PaymentAssetCode } from '@/types/user'

export function SendByPublicKey({
  defaultAsset,
}: {
  defaultAsset?: PaymentAssetCode
}) {
  const assetOptions = paymentAssetOptions()
  const [destination, setDestination] = useState('')
  const [amount, setAmount] = useState('')
  const [asset, setAsset] = useState<PaymentAssetCode>(
    defaultAsset ?? assetOptions[0]?.value ?? 'XLM',
  )
  const [memo, setMemo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [hash, setHash] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setHash(null)

    const dest = destination.trim()
    if (!StrKey.isValidEd25519PublicKey(dest)) {
      setError('La public key de destino no es válida')
      return
    }
    if (!/^\d+(\.\d{1,7})?$/.test(amount) || Number(amount) <= 0) {
      setError('El monto no es válido')
      return
    }

    setSubmitting(true)
    try {
      const result = await confirmPaymentWithFeeBump({
        version: 1,
        destination: dest,
        amount,
        asset,
        memo: memo.trim(),
      })
      setHash(result.hash)
      setAmount('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="grid gap-3" onSubmit={(event) => void onSubmit(event)}>
      <label className="grid gap-1 text-sm font-medium">
        Public key destino
        <input
          className="rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm font-normal"
          name="destination"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="G..."
          autoComplete="off"
          required
        />
      </label>

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
          placeholder="Opcional"
          maxLength={28}
        />
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-xl bg-app-accent text-black py-2.5 text-sm font-medium disabled:opacity-60 inline-flex items-center justify-center gap-2"
      >
        <Send className="w-4 h-4" />
        {submitting ? 'Enviando…' : 'Enviar'}
      </button>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {hash ? (
        <p className="text-sm text-green-400 break-all">
          Enviado. Hash: {hash}
        </p>
      ) : null}
    </form>
  )
}
