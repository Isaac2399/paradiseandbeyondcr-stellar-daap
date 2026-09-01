import { useCallback, useEffect, useState } from 'react'
import {
  getRecentPayments,
  type AccountActivity,
} from '@/lib/stellar/getPayments'

const POLL_MS = 20_000

export function useRecentActivity(publicKey: string) {
  const [items, setItems] = useState<AccountActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!publicKey) {
        setItems([])
        setLoading(false)
        return
      }
      try {
        const next = await getRecentPayments(publicKey, signal)
        if (signal?.aborted) {
          return
        }
        setItems(next)
        setError(null)
      } catch (err) {
        if (signal?.aborted) {
          return
        }
        setError(
          err instanceof Error ? err.message : 'No se pudo cargar la actividad',
        )
      } finally {
        if (!signal?.aborted) {
          setLoading(false)
        }
      }
    },
    [publicKey],
  )

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    void load(controller.signal)

    const id = window.setInterval(() => {
      if (document.hidden) {
        return
      }
      void load()
    }, POLL_MS)

    return () => {
      controller.abort()
      window.clearInterval(id)
    }
  }, [load])

  return { items, loading, error }
}
