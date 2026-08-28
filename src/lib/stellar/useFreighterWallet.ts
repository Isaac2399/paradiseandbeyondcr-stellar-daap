import { useCallback, useEffect, useState } from 'react'
import {
  assertTestnet,
  connectFreighterPublicKey,
  isFreighterInstalled,
  readFreighterPublicKey,
  watchFreighterAddress,
} from '@/lib/stellar/freighter'

type FreighterState = {
  address: string | null
  installed: boolean | null
  connecting: boolean
  error: string | null
  connect: () => Promise<void>
}

export function useFreighterWallet(): FreighterState {
  const [address, setAddress] = useState<string | null>(null)
  const [installed, setInstalled] = useState<boolean | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const hasExtension = await isFreighterInstalled()
        if (cancelled) {
          return
        }
        setInstalled(hasExtension)
        if (!hasExtension) {
          return
        }
        const current = await readFreighterPublicKey()
        if (cancelled || !current) {
          return
        }
        await assertTestnet()
        if (!cancelled) {
          setAddress(current)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo leer Freighter')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!installed) {
      return
    }
    return watchFreighterAddress((next) => {
      setAddress(next)
    })
  }, [installed])

  const connect = useCallback(async () => {
    setConnecting(true)
    setError(null)
    try {
      const next = await connectFreighterPublicKey()
      setInstalled(true)
      setAddress(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo conectar Freighter')
    } finally {
      setConnecting(false)
    }
  }, [])

  return { address, installed, connecting, error, connect }
}
