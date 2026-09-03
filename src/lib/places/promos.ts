import type { PlacePromo, PlacePromoKind } from '@/types/user'

export const PLACE_PROMO_KINDS: PlacePromoKind[] = ['story', 'purchase', 'usdc']

export type PlaceOfferFilter = 'all' | 'discount' | PlacePromoKind

export function formatPlacePromo(promo: PlacePromo, loyaltyCode: string): string {
  if (promo.kind === 'story') {
    return `Por subir historia te regalamos ${promo.rojos} ${loyaltyCode}`
  }
  if (promo.kind === 'purchase') {
    return `Por compra de ${promo.spend} USDC te regalamos ${promo.rojos} ${loyaltyCode}`
  }
  return `Si pagas con USDC te damos ${promo.rojos} ${loyaltyCode}`
}

export function formatAcceptsRojos(loyaltyCode: string): string {
  return `Aceptamos ${loyaltyCode} como descuento`
}

export function promoByKind(
  promos: PlacePromo[] | undefined,
  kind: PlacePromoKind,
): PlacePromo | undefined {
  return promos?.find((promo) => promo.kind === kind)
}

export function placeOfferFilters(loyaltyCode: string): {
  id: PlaceOfferFilter
  label: string
  chip: string
}[] {
  return [
    {
      id: 'discount',
      label: `Aceptan ${loyaltyCode} como descuento`,
      chip: `Descuento ${loyaltyCode}`,
    },
    {
      id: 'story',
      label: `Por subir historia te regalan ${loyaltyCode}`,
      chip: 'Historia',
    },
    {
      id: 'purchase',
      label: `Por compra te regalan ${loyaltyCode}`,
      chip: 'Por compra',
    },
    {
      id: 'usdc',
      label: `Si pagas con USDC te dan ${loyaltyCode}`,
      chip: 'Pago USDC',
    },
  ]
}

export function placeMatchesOffer(
  place: { acceptsRojos?: boolean; promos?: PlacePromo[] },
  filter: PlaceOfferFilter,
): boolean {
  if (filter === 'all') {
    return true
  }
  if (filter === 'discount') {
    return Boolean(place.acceptsRojos)
  }
  return Boolean(promoByKind(place.promos, filter))
}

export function placeMatchesAnyOffer(
  place: { acceptsRojos?: boolean; promos?: PlacePromo[] },
  filters: PlaceOfferFilter[],
): boolean {
  const active = filters.filter((filter) => filter !== 'all')
  if (active.length === 0) {
    return true
  }
  return active.some((filter) => placeMatchesOffer(place, filter))
}
