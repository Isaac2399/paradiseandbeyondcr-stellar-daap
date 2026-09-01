import type { AppUser, BusinessPlace, PublicPlace } from '@/types/user'
import { AuthApiError } from '@/lib/auth/api'

export type GeocodeHit = {
  label: string
  lat: number
  lng: number
}

export async function fetchPublicPlaces(): Promise<PublicPlace[]> {
  const response = await fetch('/api/places', { credentials: 'include' })
  const body = await readJson<{ places?: PublicPlace[]; error?: string }>(response)
  if (!response.ok) {
    throw new AuthApiError(body.error ?? 'No se pudieron cargar los locales', response.status)
  }
  return body.places ?? []
}

export async function searchPlaceQuery(q: string): Promise<GeocodeHit[]> {
  const response = await fetch(
    `/api/places/search?q=${encodeURIComponent(q)}`,
    { credentials: 'include' },
  )
  const body = await readJson<{ hits?: GeocodeHit[]; error?: string }>(response)
  if (!response.ok) {
    throw new AuthApiError(body.error ?? 'No se pudo buscar la dirección', response.status)
  }
  return body.hits ?? []
}

export async function reversePlace(
  lat: number,
  lng: number,
): Promise<{ address: string; lat: number; lng: number }> {
  const response = await fetch('/api/places/reverse', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lng }),
  })
  const body = await readJson<{
    address?: string
    lat?: number
    lng?: number
    error?: string
  }>(response)
  if (!response.ok) {
    throw new AuthApiError(body.error ?? 'No se pudo leer el punto', response.status)
  }
  return {
    address: body.address ?? '',
    lat: body.lat ?? lat,
    lng: body.lng ?? lng,
  }
}

export async function saveBusinessPlace(place: BusinessPlace): Promise<AppUser> {
  const response = await fetch('/api/places', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(place),
  })
  const body = await readJson<AppUser & { error?: string }>(response)
  if (!response.ok) {
    throw new AuthApiError(body.error ?? 'No se pudo guardar el local', response.status)
  }
  return body
}

export async function deleteBusinessPlace(): Promise<AppUser> {
  const response = await fetch('/api/places', {
    method: 'DELETE',
    credentials: 'include',
  })
  const body = await readJson<AppUser & { error?: string }>(response)
  if (!response.ok) {
    throw new AuthApiError(body.error ?? 'No se pudo quitar el local', response.status)
  }
  return body
}

async function readJson<T>(response: Response): Promise<T> {
  const raw = await response.text()
  if (!raw.trim()) {
    return {} as T
  }
  try {
    return JSON.parse(raw) as T
  } catch {
    return {} as T
  }
}
