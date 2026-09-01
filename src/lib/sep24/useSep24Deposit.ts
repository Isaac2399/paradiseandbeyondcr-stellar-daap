import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ensureUsdcTrustline,
  fetchSep24Transaction,
  Sep24ApiError,
  startSep24Deposit,
} from './api'
import {
  isTerminalSep24Status,
  type Sep24InteractiveResponse,
  type Sep24Transaction,
} from './types'

const POLL_MS = 5_000

export type Sep24Phase =
  | 'idle'
  | 'trustline'
  | 'starting'
  | 'interactive'
  | 'completed'
  | 'error'

export function useSep24Deposit(onCompleted?: () => void) {
  const [phase, setPhase] = useState<Sep24Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | undefined>()
  const [session, setSession] = useState<Sep24InteractiveResponse | null>(null)
  const [transaction, setTransaction] = useState<Sep24Transaction | null>(null)
  const onCompletedRef = useRef(onCompleted)
  onCompletedRef.current = onCompleted

  const reset = useCallback(() => {
    setPhase('idle')
    setError(null)
    setErrorCode(undefined)
    setSession(null)
    setTransaction(null)
  }, [])

  const openTrustline = useCallback(async () => {
    setPhase('trustline')
    setError(null)
    setErrorCode(undefined)
    try {
      await ensureUsdcTrustline()
      setPhase('idle')
      return true
    } catch (err) {
      applyError(err, setError, setErrorCode, setPhase)
      return false
    }
  }, [])

  const start = useCallback(async (amount?: string) => {
    setPhase('starting')
    setError(null)
    setErrorCode(undefined)
    setTransaction(null)
    try {
      const next = await startSep24Deposit(amount)
      setSession(next)
      setPhase('interactive')
      return next
    } catch (err) {
      applyError(err, setError, setErrorCode, setPhase)
      return null
    }
  }, [])

  useEffect(() => {
    if (phase !== 'interactive' || !session) {
      return
    }
    let cancelled = false

    async function poll() {
      if (document.hidden || !session) {
        return
      }
      try {
        const next = await fetchSep24Transaction(session.id)
        if (cancelled) {
          return
        }
        setTransaction(next)
        if (next.status === 'completed') {
          setPhase('completed')
          onCompletedRef.current?.()
          return
        }
        if (isTerminalSep24Status(next.status)) {
          setPhase('error')
          setError(next.message || `El depósito terminó: ${next.status}`)
        }
      } catch (err) {
        if (cancelled) {
          return
        }
        if (err instanceof Sep24ApiError && err.code === 'expired_session') {
          setPhase('error')
          setErrorCode(err.code)
          setError(err.message)
        }
      }
    }

    void poll()
    const id = window.setInterval(() => {
      void poll()
    }, POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [phase, session])

  return {
    phase,
    error,
    errorCode,
    session,
    transaction,
    start,
    openTrustline,
    reset,
  }
}

function applyError(
  err: unknown,
  setError: (value: string | null) => void,
  setErrorCode: (value: string | undefined) => void,
  setPhase: (value: Sep24Phase) => void,
) {
  setPhase('error')
  if (err instanceof Sep24ApiError) {
    setError(err.message)
    setErrorCode(err.code)
    return
  }
  setError(err instanceof Error ? err.message : 'No se pudo iniciar el depósito')
  setErrorCode(undefined)
}
