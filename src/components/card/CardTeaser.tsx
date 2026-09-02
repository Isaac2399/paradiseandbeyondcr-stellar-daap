import { useEffect, useState } from 'react'
import { ChevronRight, CreditCard } from 'lucide-react'
import { Link } from 'react-router-dom'
import { fetchMyCard } from '@/lib/cards/api'
import type { PublicCard } from '@/lib/cards/types'

export function CardTeaser() {
  const [card, setCard] = useState<PublicCard | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    void fetchMyCard()
      .then((next) => {
        if (!cancelled) {
          setCard(next)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCard(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const last4 = card?.last4
  const frozen = card?.status === 'frozen'

  return (
    <Link
      to="/card"
      className="flex items-center gap-3 rounded-[24px] bg-app-card px-4 py-4"
    >
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/5">
        <CreditCard className="h-5 w-5 text-app-accent" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Tarjeta Visa virtual</p>
        <p className="mt-0.5 text-xs text-app-muted">
          {card === undefined
            ? 'Cargando…'
            : last4
              ? `•••• ${last4}${frozen ? ' · congelada' : ''}`
              : 'Emite una Visa ligada a tu wallet'}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 text-white/40" />
    </Link>
  )
}