import { useEffect, useState, type FormEvent } from 'react'
import { Banknote, Check, Copy, ExternalLink } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { stellarConfig } from '@/lib/stellar/config'
import { useSep24Deposit } from '@/lib/sep24/useSep24Deposit'
import type { Sep24Transaction } from '@/lib/sep24/types'

type AddFundsSheetProps = {
  publicKey: string
  copied: boolean
  hasUsdcTrustline: boolean
  onCopy: () => void
  onClose: () => void
  onDepositCompleted?: () => void
}

export function AddFundsSheet({
  publicKey,
  copied,
  hasUsdcTrustline,
  onCopy,
  onClose,
  onDepositCompleted,
}: AddFundsSheetProps) {
  const [tab, setTab] = useState<'cash' | 'receive'>('cash')

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-funds-title"
    >
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-[28px] bg-app-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="add-funds-title" className="text-lg font-semibold">
            Agregar
          </h2>
          <button type="button" className="text-sm text-app-muted" onClick={onClose}>
            Cerrar
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <TabButton
            active={tab === 'cash'}
            label="Depositar USDC"
            onClick={() => setTab('cash')}
          />
          <TabButton
            active={tab === 'receive'}
            label="Recibir on-chain"
            onClick={() => setTab('receive')}
          />
        </div>

        {tab === 'cash' ? (
          <CashDepositPanel
            hasUsdcTrustline={hasUsdcTrustline}
            onCompleted={onDepositCompleted}
          />
        ) : (
          <ReceiveOnchain
            publicKey={publicKey}
            copied={copied}
            onCopy={onCopy}
          />
        )}
      </div>
    </div>
  )
}

function TabButton({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl px-3 py-2 text-sm font-medium ${
        active ? 'bg-app-accent text-black' : 'bg-app-chip text-white/80'
      }`}
    >
      {label}
    </button>
  )
}

function CashDepositPanel({
  hasUsdcTrustline,
  onCompleted,
}: {
  hasUsdcTrustline: boolean
  onCompleted?: () => void
}) {
  const deposit = useSep24Deposit(onCompleted)
  const [amount, setAmount] = useState('')
  const [trustOk, setTrustOk] = useState(hasUsdcTrustline)
  const [iframeBlocked, setIframeBlocked] = useState(false)

  useEffect(() => {
    if (hasUsdcTrustline) {
      setTrustOk(true)
    }
    if (deposit.errorCode === 'missing_trustline') {
      setTrustOk(false)
    }
  }, [hasUsdcTrustline, deposit.errorCode])

  const needsTrustline = !trustOk || deposit.errorCode === 'missing_trustline'
  const showStartForm =
    trustOk &&
    !deposit.session &&
    (deposit.phase === 'idle' || deposit.phase === 'error')

  async function onStart(event: FormEvent) {
    event.preventDefault()
    const session = await deposit.start(amount.trim() || undefined)
    if (session?.url) {
      window.open(session.url, 'sep24-deposit', 'noopener,noreferrer')
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-app-muted">
        Depósito en efectivo vía SEP-24 (ancla tipo MoneyGram Access). Recibes
        USDC de Testnet en tu cuenta.
      </p>

      {needsTrustline && deposit.phase !== 'interactive' && deposit.phase !== 'completed' ? (
        <div className="space-y-3 rounded-2xl bg-app-chip p-4">
          <p className="text-sm">
            Esta cuenta aún no confía USDC. El ancla no puede enviarte fondos
            sin esa trustline.
          </p>
          <button
            type="button"
            onClick={() => {
              void deposit.openTrustline().then((ok) => {
                if (ok) {
                  setTrustOk(true)
                }
              })
            }}
            disabled={deposit.phase === 'trustline'}
            className="w-full rounded-2xl bg-app-accent py-3 text-sm font-medium text-black disabled:opacity-60"
          >
            {deposit.phase === 'trustline' ? 'Abriendo trustline…' : 'Abrir trustline USDC'}
          </button>
        </div>
      ) : null}

      {showStartForm ? (
        <form className="space-y-3" onSubmit={(event) => void onStart(event)}>
          <label className="grid gap-1 text-sm">
            Monto USDC (opcional)
            <input
              className="rounded-2xl border border-app-line bg-app-chip px-3 py-2 text-sm"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Ej. 20.00"
            />
          </label>
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-app-accent py-3 text-sm font-medium text-black"
          >
            <Banknote className="h-4 w-4" />
            Continuar con el ancla
          </button>
        </form>
      ) : null}

      {deposit.phase === 'starting' ? (
        <p className="text-sm text-app-muted">Autenticando SEP-10 y abriendo SEP-24…</p>
      ) : null}

      {deposit.session ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Flujo interactivo del ancla</p>
            <a
              href={deposit.session.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-app-accent"
            >
              Abrir en ventana
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          {iframeBlocked ? (
            <p className="rounded-2xl bg-app-chip p-3 text-sm text-app-muted">
              El ancla no permite incrustar su página. Usa Abrir en ventana.
            </p>
          ) : (
            <iframe
              title="Depósito SEP-24"
              src={deposit.session.url}
              className="h-[52vh] w-full rounded-2xl bg-black"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
              onError={() => setIframeBlocked(true)}
            />
          )}
          <TransactionStatus tx={deposit.transaction} />
        </div>
      ) : null}

      {deposit.phase === 'completed' ? (
        <p className="text-sm text-green-400">Depósito completado. El USDC ya está en tu cuenta.</p>
      ) : null}

      {deposit.error ? <p className="text-sm text-red-400">{deposit.error}</p> : null}

      {deposit.phase === 'error' && deposit.errorCode === 'expired_session' ? (
        <button
          type="button"
          onClick={() => deposit.reset()}
          className="w-full rounded-2xl bg-app-chip py-3 text-sm"
        >
          Reintentar sesión
        </button>
      ) : null}
    </div>
  )
}

function TransactionStatus({ tx }: { tx: Sep24Transaction | null }) {
  if (!tx) {
    return (
      <p className="text-xs text-app-muted">
        Esperando estado del ancla…
      </p>
    )
  }

  return (
    <div className="rounded-2xl bg-app-chip p-3 text-sm">
      <p className="font-medium">{statusLabel(tx.status)}</p>
      {tx.message ? <p className="mt-1 text-app-muted">{tx.message}</p> : null}
      {tx.amount_out ? (
        <p className="mt-1 tabular-nums">
          {tx.amount_out} {tx.amount_out_asset ? 'USDC' : ''}
        </p>
      ) : null}
      {tx.external_transaction_id ? (
        <p className="mt-1 font-mono text-xs text-app-muted">
          Ref {tx.external_transaction_id}
        </p>
      ) : null}
    </div>
  )
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    incomplete: 'Pendiente de datos',
    pending_user_transfer_start: 'Paga en el agente (efectivo)',
    pending_user_transfer_complete: 'Esperando confirmación del agente',
    pending_anchor: 'El ancla está procesando',
    pending_stellar: 'Enviando USDC en Stellar',
    pending_external: 'Procesando fuera de Stellar',
    pending_trust: 'Falta trustline de USDC',
    pending_user: 'Acción pendiente en el ancla',
    completed: 'Completado',
    error: 'Error',
    expired: 'Expirado',
  }
  return labels[status] ?? status
}

function ReceiveOnchain({
  publicKey,
  copied,
  onCopy,
}: {
  publicKey: string
  copied: boolean
  onCopy: () => void
}) {
  return (
    <>
      <p className="mb-4 text-sm text-app-muted">
        Comparte tu public key para recibir XLM, USDC o {stellarConfig.loyalty.code} en
        Testnet.
      </p>
      <div className="mx-auto mb-4 w-fit rounded-2xl bg-white p-3">
        <QRCodeSVG value={publicKey} size={200} level="M" includeMargin />
      </div>
      <p className="mb-3 break-all text-center font-mono text-xs text-white/70">
        {publicKey}
      </p>
      <button
        type="button"
        onClick={onCopy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-app-accent py-3 text-sm font-medium text-black"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? 'Public key copiada' : 'Copiar public key'}
      </button>
    </>
  )
}
