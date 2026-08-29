import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Copy, Wallet } from 'lucide-react'
import { getBalances, EMPTY_BALANCES, type AccountBalances } from '@/lib/stellar/getBalances'
import { stellarConfig } from '@/lib/stellar/config'

type WalletOverviewProps = {
  publicKey: string
}

const POLL_MS = 12_000

function formatAmount(value: string): string {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return value
  }
  return new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 7,
  }).format(numeric)
}

function buildOnrampUrl(publicKey: string): string {
  const template = import.meta.env.VITE_ONRAMP_WIDGET_URL
  if (template) {
    return template.replaceAll('{publicKey}', publicKey)
  }

  const params = new URLSearchParams({
    defaultCrypto: 'xlm',
    onlyCryptos: 'xlm,usdc_stellar',
    themeName: 'light',
    networkWallets: `stellar:${publicKey}`,
  })
  return `https://buy.onramper.com?${params.toString()}`
}

export function WalletOverview({ publicKey }: WalletOverviewProps) {
  const [copied, setCopied] = useState(false)
  const [onrampOpen, setOnrampOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [balances, setBalances] = useState<AccountBalances>(EMPTY_BALANCES)

  const loadBalances = useCallback(async () => {
    try {
      let next = await getBalances(publicKey)
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const funded = Number(next.xlm) > 0
        const loyaltyReady =
          !stellarConfig.loyalty.issuer ||
          next.raw.some(
            (entry) =>
              entry.assetCode?.toUpperCase() ===
              stellarConfig.loyalty.code.toUpperCase(),
          )
        if (funded && loyaltyReady) {
          break
        }
        await new Promise((resolve) => window.setTimeout(resolve, 1000))
        next = await getBalances(publicKey)
      }
      setBalances(next)
      setError(null)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudieron leer los saldos',
      )
    }
  }, [publicKey])

  useEffect(() => {
    void loadBalances()
    const id = window.setInterval(() => {
      void loadBalances()
    }, POLL_MS)
    return () => window.clearInterval(id)
  }, [loadBalances])

  useEffect(() => {
    if (!copied) {
      return
    }
    const id = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(id)
  }, [copied])

  const onrampUrl = useMemo(() => buildOnrampUrl(publicKey), [publicKey])

  async function copyPublicKey() {
    await navigator.clipboard.writeText(publicKey)
    setCopied(true)
  }

  const cards = [
    { label: 'XLM', value: balances.xlm },
    { label: 'USDC', value: balances.usdc },
    { label: stellarConfig.loyalty.code, value: balances.loyalty },
  ]

  return (
    <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Public Key
          </p>
          <p className="mt-1 font-mono text-sm break-all text-slate-800">{publicKey}</p>
        </div>
        <button
          type="button"
          onClick={() => void copyPublicKey()}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copiada' : 'Copiar'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl bg-slate-50 border border-slate-100 p-4"
          >
            <p className="text-xs text-slate-500">{card.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {formatAmount(card.value)}
            </p>
          </div>
        ))}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="button"
        onClick={() => setOnrampOpen(true)}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 text-white py-2.5 text-sm font-medium hover:bg-blue-700"
      >
        <Wallet className="w-4 h-4" />
        Comprar USDC / XLM
      </button>

      {onrampOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="onramp-title"
        >
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <h2 id="onramp-title" className="font-semibold">
                Comprar USDC / XLM
              </h2>
              <button
                type="button"
                className="text-sm text-slate-500 hover:text-slate-800"
                onClick={() => setOnrampOpen(false)}
              >
                Cerrar
              </button>
            </div>
            <iframe
              title="On-ramp Stellar"
              src={onrampUrl}
              className="w-full h-[520px] border-0"
              allow="accelerometer; camera; microphone; payment"
            />
          </div>
        </div>
      ) : null}
    </section>
  )
}
