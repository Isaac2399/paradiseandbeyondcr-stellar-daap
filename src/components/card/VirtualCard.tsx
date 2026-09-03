import { Eye, EyeOff, LoaderCircle, Nfc } from 'lucide-react'
import type { PublicCard, SecureCardDetails } from '@/lib/cards/types'

type VirtualCardProps = {
  card: PublicCard
  revealed: SecureCardDetails | null
  revealing: boolean
  onToggleReveal: () => void
}

export function VirtualCard({
  card,
  revealed,
  revealing,
  onToggleReveal,
}: VirtualCardProps) {
  const frozen = card.status === 'frozen'
  const pan = revealed
    ? formatPan(revealed.pan)
    : `•••• •••• •••• ${card.last4}`
  const expiry = revealed
    ? `${revealed.expMonth}/${revealed.expYear}`
    : '••/••'
  const cvv = revealed ? revealed.cvv : '•••'

  return (
    <div className="visa-card-wrap">
      <article
        className={`visa-card ${frozen ? 'is-frozen' : ''}`}
        aria-label={`Tarjeta Visa virtual terminada en ${card.last4}`}
      >
        <div className="visa-card-shine" />
        <header className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/55">
              Virtual
            </p>
            <p className="mt-1 text-xs font-medium text-[#f5c400]">
              Stellar Pay
            </p>
          </div>
          <VisaMark />
        </header>

        <div className="mt-6 flex items-end justify-between">
          <ChipMark />
          <Nfc className="h-6 w-6 rotate-90 text-white/70" strokeWidth={1.6} />
        </div>

        <p className="mt-6 font-mono text-[1.15rem] tracking-[0.18em] text-white">
          {pan}
        </p>

        <div className="mt-5 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[9px] uppercase tracking-[0.18em] text-white/45">
              Titular
            </p>
            <p className="mt-0.5 truncate text-sm font-medium tracking-wide">
              {card.holderName}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-[0.18em] text-white/45">
              Expira
            </p>
            <p className="mt-0.5 font-mono text-sm tabular-nums">{expiry}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-[0.18em] text-white/45">
              CVV
            </p>
            <p className="mt-0.5 font-mono text-sm tabular-nums">{cvv}</p>
          </div>
        </div>

        {frozen ? (
          <div className="visa-card-frozen">
            <p className="text-xs font-semibold uppercase tracking-[0.2em]">
              Congelada
            </p>
          </div>
        ) : null}
      </article>

      <button
        type="button"
        onClick={onToggleReveal}
        disabled={revealing}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-app-card py-3 text-sm font-medium text-white/90 disabled:opacity-60"
      >
        {revealing ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : revealed ? (
          <EyeOff className="h-4 w-4" />
        ) : (
          <Eye className="h-4 w-4" />
        )}
        {revealed ? 'Ocultar detalles' : 'Ver detalles'}
      </button>
      <p className="mt-2 text-center text-[11px] text-app-muted">
        Los datos sensibles se piden al servidor (sandbox PCI). Se ocultan solos.
      </p>
    </div>
  )
}

function formatPan(pan: string): string {
  return pan.replace(/(\d{4})(?=\d)/g, '$1 ').trim()
}

function ChipMark() {
  return (
    <span className="visa-chip" aria-hidden>
      <span className="visa-chip-line" />
      <span className="visa-chip-line" />
      <span className="visa-chip-line" />
    </span>
  )
}

function VisaMark() {
  return (
    <span className="select-none text-[1.35rem] font-black italic tracking-tight text-white">
      VISA
    </span>
  )
}
