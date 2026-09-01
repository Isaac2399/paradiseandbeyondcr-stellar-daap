export const BUSINESS_CATEGORY_IDS = [
  'hotel',
  'restaurant',
  'cafe',
  'bar',
  'supermarket',
  'grocery',
  'bakery',
  'pharmacy',
  'salon',
  'spa',
  'gym',
  'shop',
  'clothing',
  'electronics',
  'gas',
  'clinic',
  'tourism',
  'other',
] as const

export type BusinessCategory = (typeof BUSINESS_CATEGORY_IDS)[number]

export const BUSINESS_CATEGORIES: { id: BusinessCategory; label: string }[] = [
  { id: 'hotel', label: 'Hotel' },
  { id: 'restaurant', label: 'Restaurante' },
  { id: 'cafe', label: 'Café' },
  { id: 'bar', label: 'Bar' },
  { id: 'supermarket', label: 'Supermercado' },
  { id: 'grocery', label: 'Pulpería / minisúper' },
  { id: 'bakery', label: 'Panadería' },
  { id: 'pharmacy', label: 'Farmacia' },
  { id: 'salon', label: 'Peluquería' },
  { id: 'spa', label: 'Spa / estética' },
  { id: 'gym', label: 'Gimnasio' },
  { id: 'shop', label: 'Tienda' },
  { id: 'clothing', label: 'Ropa' },
  { id: 'electronics', label: 'Electrónica' },
  { id: 'gas', label: 'Gasolinera' },
  { id: 'clinic', label: 'Clínica / salud' },
  { id: 'tourism', label: 'Tours / turismo' },
  { id: 'other', label: 'Otro' },
]

const LABEL_BY_ID = Object.fromEntries(
  BUSINESS_CATEGORIES.map((item) => [item.id, item.label]),
) as Record<BusinessCategory, string>

export function isBusinessCategory(value: string): value is BusinessCategory {
  return (BUSINESS_CATEGORY_IDS as readonly string[]).includes(value)
}

export function categoryLabel(id: string | undefined): string {
  if (id && isBusinessCategory(id)) {
    return LABEL_BY_ID[id]
  }
  return LABEL_BY_ID.other
}

export function placeCategory(id: string | undefined): BusinessCategory {
  return id && isBusinessCategory(id) ? id : 'other'
}
