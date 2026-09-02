import { useEffect, useMemo, useState } from 'react'
import { MapPin, Navigation } from 'lucide-react'
import { DarkLeafletMap } from '@/components/map/DarkLeafletMap'
import { fetchPublicPlaces } from '@/lib/places/api'
import { readableError } from '@/lib/auth/readableError'
import {
  BUSINESS_CATEGORIES,
  categoryLabel,
  placeCategory,
  type BusinessCategory,
} from '@/lib/places/categories'
import type { PublicPlace } from '@/types/user'

export function CustomerPlacesMap() {
  const [places, setPlaces] = useState<PublicPlace[]>([])
  const [category, setCategory] = useState<'all' | BusinessCategory>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void fetchPublicPlaces()
      .then((next) => {
        if (cancelled) {
          return
        }
        setPlaces(next)
        setSelectedId(next[0]?.id ?? null)
        setError(null)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(readableError(err))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    if (category === 'all') {
      return places
    }
    return places.filter((place) => placeCategory(place.category) === category)
  }, [places, category])

  useEffect(() => {
    if (filtered.some((place) => place.id === selectedId)) {
      return
    }
    setSelectedId(filtered[0]?.id ?? null)
  }, [filtered, selectedId])

  const selected = filtered.find((place) => place.id === selectedId) ?? filtered[0]
  const hasAnyPlaces = places.length > 0

  return (
    <div className="space-y-4">
      {hasAnyPlaces ? (
        <div className="space-y-2">
          <label className="grid gap-1.5 text-sm font-medium text-white/80">
            Filtrar por tipo
            <select
              className="w-full rounded-2xl border border-app-line bg-app-chip px-3 py-2.5 text-sm text-white outline-none"
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as 'all' | BusinessCategory)
              }
            >
              <option value="all">Todos los negocios</option>
              {BUSINESS_CATEGORIES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <FilterChip
              active={category === 'all'}
              label="Todos"
              onClick={() => setCategory('all')}
            />
            {BUSINESS_CATEGORIES.filter((item) =>
              places.some((place) => placeCategory(place.category) === item.id),
            ).map((item) => (
              <FilterChip
                key={item.id}
                active={category === item.id}
                label={item.label}
                onClick={() => setCategory(item.id)}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[24px] bg-app-card">
        <div className="h-72">
          <DarkLeafletMap
            markers={filtered.map((place) => ({
              id: place.id,
              lat: place.lat,
              lng: place.lng,
              selected: place.id === selected?.id,
            }))}
            onSelect={setSelectedId}
          />
        </div>
      </div>

      {!hasAnyPlaces && !loading ? (
        <p className="rounded-[24px] bg-app-card px-4 py-5 text-center text-sm text-app-muted">
          Todavía no hay negocios publicados. Cuando una empresa fije su
          dirección, el pin aparece aquí.
        </p>
      ) : null}

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {hasAnyPlaces && filtered.length === 0 ? (
        <p className="rounded-[24px] bg-app-card px-4 py-5 text-center text-sm text-app-muted">
          No hay negocios de este tipo todavía. Prueba otro filtro.
        </p>
      ) : null}

      {selected ? (
        <article className="rounded-[24px] bg-app-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-app-accent">
            {categoryLabel(selected.category)}
          </p>
          <h2 className="mt-1 text-lg font-semibold">{selected.name}</h2>
          <p className="mt-2 flex items-start gap-2 text-sm text-white/80">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-app-accent" />
            {selected.address}
          </p>
          {selected.note ? (
            <p className="mt-2 text-sm text-app-muted">{selected.note}</p>
          ) : null}
          <a
            href={mapsUrl(selected.lat, selected.lng, selected.name)}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-app-accent py-3 text-sm font-medium text-black"
          >
            <Navigation className="h-4 w-4" />
            Cómo llegar
          </a>
        </article>
      ) : null}

      {filtered.length > 1 ? (
        <ul className="space-y-2">
          {filtered.map((place) => (
            <li key={place.id}>
              <button
                type="button"
                onClick={() => setSelectedId(place.id)}
                className={`w-full rounded-2xl px-4 py-3 text-left ${
                  place.id === selected?.id ? 'bg-app-card' : 'bg-app-chip'
                }`}
              >
                <p className="text-sm font-medium">{place.name}</p>
                <p className="mt-0.5 text-[11px] text-app-accent">
                  {categoryLabel(place.category)}
                </p>
                <p className="mt-0.5 truncate text-xs text-app-muted">
                  {place.address}
                </p>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function FilterChip({
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
      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
        active ? 'bg-app-accent text-black' : 'bg-app-chip text-white/75'
      }`}
    >
      {label}
    </button>
  )
}

function mapsUrl(lat: number, lng: number, name: string): string {
  const query = encodeURIComponent(`${name} ${lat},${lng}`)
  return `https://www.google.com/maps/search/?api=1&query=${query}`
}
