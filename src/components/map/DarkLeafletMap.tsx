import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export const DEFAULT_MAP_CENTER: [number, number] = [9.932, -84.079]
export const DEFAULT_MAP_ZOOM = 13

export type MapMarker = {
  id: string
  lat: number
  lng: number
  selected?: boolean
}

type DarkLeafletMapProps = {
  markers: MapMarker[]
  center?: [number, number]
  zoom?: number
  onSelect?: (id: string) => void
  onMapClick?: (lat: number, lng: number) => void
}

export function DarkLeafletMap({
  markers,
  center = DEFAULT_MAP_CENTER,
  zoom = DEFAULT_MAP_ZOOM,
  onSelect,
  onMapClick,
}: DarkLeafletMapProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const onSelectRef = useRef(onSelect)
  const onMapClickRef = useRef(onMapClick)
  onSelectRef.current = onSelect
  onMapClickRef.current = onMapClick

  useEffect(() => {
    const host = hostRef.current
    if (!host || mapRef.current) {
      return
    }

    const map = L.map(host, {
      zoomControl: false,
      attributionControl: true,
    }).setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM)

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      maxZoom: 19,
    }).addTo(map)
    L.control.zoom({ position: 'bottomright' }).addTo(map)

    map.on('click', (event) => {
      onMapClickRef.current?.(event.latlng.lat, event.latlng.lng)
    })

    mapRef.current = map
    layerRef.current = L.layerGroup().addTo(map)

    const frame = window.requestAnimationFrame(() => map.invalidateSize())
    return () => {
      window.cancelAnimationFrame(frame)
      map.remove()
      mapRef.current = null
      layerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) {
      return
    }

    layer.clearLayers()
    for (const marker of markers) {
      const pin = L.marker([marker.lat, marker.lng], {
        icon: pinIcon(Boolean(marker.selected)),
      })
      pin.on('click', (event) => {
        L.DomEvent.stopPropagation(event)
        onSelectRef.current?.(marker.id)
      })
      pin.addTo(layer)
    }

    if (markers.length > 1) {
      const bounds = L.latLngBounds(markers.map((item) => [item.lat, item.lng]))
      map.fitBounds(bounds.pad(0.28), { maxZoom: 15, animate: false })
      return
    }
    if (markers[0]) {
      map.setView([markers[0].lat, markers[0].lng], Math.max(map.getZoom(), 15), {
        animate: false,
      })
      return
    }
    map.setView(center, zoom, { animate: false })
  }, [markers, center, zoom])

  return <div ref={hostRef} className="places-map h-full min-h-[280px] w-full" />
}

function pinIcon(selected: boolean): L.DivIcon {
  return L.divIcon({
    className: selected ? 'place-pin is-selected' : 'place-pin',
    html: '<span class="place-pin-mark"></span>',
    iconSize: [28, 36],
    iconAnchor: [14, 34],
  })
}
