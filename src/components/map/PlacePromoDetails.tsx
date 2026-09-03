import { Gift, TicketPercent } from 'lucide-react'
import {
  formatAcceptsRojos,
  formatPlacePromo,
} from '@/lib/places/promos'
import { stellarConfig } from '@/lib/stellar/config'
import type { PlacePromo } from '@/types/user'

export function PlacePromoDetails({
  acceptsRojos,
  promos,
}: {
  acceptsRojos?: boolean
  promos?: PlacePromo[]
}) {
  const code = stellarConfig.loyalty.code
  const giftLines = promos?.map((promo) => formatPlacePromo(promo, code)) ?? []
  const hasDiscount = Boolean(acceptsRojos)
  if (!hasDiscount && giftLines.length === 0) {
    return null
  }

  return (
    <ul className="mt-3 space-y-2">
      {hasDiscount ? (
        <li className="flex items-start gap-2 text-sm text-white/85">
          <TicketPercent className="mt-0.5 h-4 w-4 shrink-0 text-app-accent" />
          <span>{formatAcceptsRojos(code)}</span>
        </li>
      ) : null}
      {giftLines.map((line) => (
        <li key={line} className="flex items-start gap-2 text-sm text-white/85">
          <Gift className="mt-0.5 h-4 w-4 shrink-0 text-app-accent" />
          <span>{line}</span>
        </li>
      ))}
    </ul>
  )
}
