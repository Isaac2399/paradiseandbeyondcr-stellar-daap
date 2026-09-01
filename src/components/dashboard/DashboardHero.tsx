import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  Copy,
  ScanLine,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { stellarConfig } from '@/lib/stellar/config'
import { formatAmount } from '@/lib/stellar/useAccountBalances'
import type { AccountBalances } from '@/lib/stellar/getBalances'
import {
  displayNameFromEmail,
  handleFromEmail,
  initialsFromEmail,
  shortenPublicKey,
} from '@/lib/userDisplay'
import type { AppUser } from '@/types/user'

type DashboardHeroProps = {
  user: AppUser
  balances: AccountBalances
  error: string | null
  onScan: () => void
  onSend: () => void
}

type AssetKey = 'loyalty' | 'xlm' | 'usdc'

export function DashboardHero({
  user,
  balances,
  error,
  onScan,
  onSend,
}: DashboardHeroProps) {
  const [asset, setAsset] = useState<AssetKey>('loyalty')
  const [copied, setCopied] = useState(false)
  const [receiveOpen, setReceiveOpen] = useState(false)

  const assets = useMemo(
    () =>
      [
        {
          key: 'loyalty' as const,
          code: stellarConfig.loyalty.code,
          value: balances.loyalty,
        },
        { key: 'xlm' as const, code: 'XLM', value: balances.xlm },
        { key: 'usdc' as const, code: 'USDC', value: balances.usdc },
      ] as const,
    [balances],
  )

  const selected = assets.find((item) => item.key === asset) ?? assets[0]
  const others = assets.filter((item) => item.key !== selected.key)

  useEffect(() => {
    if (!copied) {
      return
    }
    const id = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(id)
  }, [copied])

  async function copyPublicKey() {
    await navigator.clipboard.writeText(user.publicKey)
    setCopied(true)
  }

  function cycleAsset() {
    const order: AssetKey[] = ['loyalty', 'xlm', 'usdc']
    const index = order.indexOf(asset)
    setAsset(order[(index + 1) % order.length] ?? 'loyalty')
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-app-chip text-sm font-semibold">
            {initialsFromEmail(user.email)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium leading-tight">
              {displayNameFromEmail(user.email)}
            </p>
            <p className="truncate text-xs text-app-muted">
              {handleFromEmail(user.email)}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onScan}
          aria-label="Escanear QR"
          className="grid h-10 w-10 place-items-center rounded-xl hover:bg-white/10"
        >
          <ScanLine className="h-5 w-5" />
        </button>
      </div>

      <div>
        <button
          type="button"
          onClick={cycleAsset}
          className="flex items-baseline gap-2 text-left"
        >
          <span className="text-5xl font-semibold tracking-tight tabular-nums">
            {formatAmount(selected.value)}
          </span>
          <span className="inline-flex items-center gap-1 text-lg font-medium text-white/55">
            {selected.code}
            <ChevronDown className="h-4 w-4" />
          </span>
        </button>
        <p className="mt-2 text-sm text-app-muted">
          ~ {others.map((item) => `${formatAmount(item.value)} ${item.code}`).join(' · ')}
        </p>
        <p className="mt-1 text-xs text-app-muted">Testnet · no es saldo fiat</p>
        {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}

        <button
          type="button"
          onClick={() => void copyPublicKey()}
          className="mt-4 inline-flex max-w-full items-center gap-2 rounded-full bg-app-chip px-3 py-1.5 text-xs text-white/80"
        >
          <span className="truncate font-mono">{shortenPublicKey(user.publicKey)}</span>
          {copied ? (
            <Check className="h-3.5 w-3.5 shrink-0 text-green-400" />
          ) : (
            <Copy className="h-3.5 w-3.5 shrink-0" />
          )}
          {copied ? 'Copiada' : 'Copiar key'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <QuickAction
          icon={ArrowDownLeft}
          label="Agregar"
          onClick={() => setReceiveOpen(true)}
        />
        <QuickAction icon={ArrowUpRight} label="Enviar" onClick={onSend} />
      </div>

      {receiveOpen ? (
        <ReceiveSheet
          publicKey={user.publicKey}
          copied={copied}
          onCopy={() => void copyPublicKey()}
          onClose={() => setReceiveOpen(false)}
        />
      ) : null}
    </section>
  )
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof ArrowUpRight
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-[22px] bg-app-card px-3 py-4 text-[13px] font-medium"
    >
      <Icon className="h-5 w-5" />
      {label}
    </button>
  )
}

function ReceiveSheet({
  publicKey,
  copied,
  onCopy,
  onClose,
}: {
  publicKey: string
  copied: boolean
  onCopy: () => void
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receive-title"
    >
      <div className="w-full max-w-md rounded-[28px] bg-app-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="receive-title" className="text-lg font-semibold">
            Agregar / Recibir
          </h2>
          <button
            type="button"
            className="text-sm text-app-muted"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
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
      </div>
    </div>
  )
}
