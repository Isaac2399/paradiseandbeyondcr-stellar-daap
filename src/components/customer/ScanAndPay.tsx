import { useEffect, useId, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import {
  deserializePaymentPayload,
  estimateLoyaltyPoints,
  isLoyaltyAsset,
  type PaymentQrPayload,
} from '@/lib/stellar/qrPayload'
import { confirmPaymentWithFeeBump } from '@/lib/stellar/feeBump'
import { stellarConfig } from '@/lib/stellar/config'
import './ScanAndPay.css'

function shortKey(publicKey: string): string {
  return `${publicKey.slice(0, 6)}…${publicKey.slice(-6)}`
}

export function ScanAndPay() {
  const rawId = useId().replace(/:/g, '')
  const scannerId = `qr-scan-${rawId}`
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const handlingRef = useRef(false)

  const [payload, setPayload] = useState<PaymentQrPayload | null>(null)
  const [pasted, setPasted] = useState('')
  const [scanError, setScanError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (payload) {
      return
    }

    let cancelled = false
    handlingRef.current = false
    const scanner = new Html5Qrcode(scannerId, { verbose: false })
    scannerRef.current = scanner

    async function start() {
      try {
        const cameras = await Html5Qrcode.getCameras()
        if (cancelled) {
          return
        }
        if (!cameras.length) {
          setScanError('No hay cámara. Pega el texto del QR abajo.')
          return
        }
        const rear = cameras.find((cam) =>
          /back|rear|environment|trasera/i.test(cam.label),
        )
        await scanner.start(
          rear?.id ?? cameras[0].id,
          {
            fps: 12,
            qrbox: (viewWidth, viewHeight) => {
              const edge = Math.floor(Math.min(viewWidth, viewHeight) * 0.8)
              return { width: edge, height: edge }
            },
            aspectRatio: 1,
            disableFlip: false,
          },
          (decoded) => {
            if (cancelled || handlingRef.current) {
              return
            }
            try {
              const parsed = deserializePaymentPayload(decoded)
              handlingRef.current = true
              setScanError(null)
              setPayload(parsed)
            } catch (err) {
              setScanError(
                err instanceof Error ? err.message : 'QR de pago inválido',
              )
            }
          },
          () => undefined,
        )
        if (cancelled) {
          await stopScanner(scanner)
        }
      } catch {
        if (!cancelled) {
          setScanError('No se pudo abrir la cámara. Pega el texto del QR abajo.')
        }
      }
    }

    const timer = window.setTimeout(() => {
      void start()
    }, 200)

    return () => {
      cancelled = true
      handlingRef.current = true
      window.clearTimeout(timer)
      void stopScanner(scanner)
      scannerRef.current = null
    }
  }, [payload, scannerId])

  function usePastedPayload() {
    try {
      const parsed = deserializePaymentPayload(pasted)
      setScanError(null)
      setPayload(parsed)
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Payload inválido')
    }
  }

  async function onConfirm() {
    if (!payload || submitting) {
      return
    }
    setSubmitting(true)
    setStatus(null)
    try {
      const result = await confirmPaymentWithFeeBump(payload)
      setStatus(`Pago enviado. Hash: ${result.hash}`)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'No se pudo confirmar el pago')
    } finally {
      setSubmitting(false)
    }
  }

  const points = payload
    ? estimateLoyaltyPoints(payload.amount, payload.asset)
    : '0'

  return (
    <div className="space-y-4">
      {!payload ? (
        <div id={scannerId} className="qr-scanner" />
      ) : null}

      {!payload ? (
        <div className="space-y-2">
          <label className="grid gap-1 text-sm font-medium">
            Pegar texto del QR
            <textarea
              className="rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs min-h-20"
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder="SP1|G...|10|ROJOS|ORD-1"
            />
          </label>
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
            onClick={usePastedPayload}
          >
            Usar payload
          </button>
        </div>
      ) : null}

      {payload ? (
        <div className="space-y-4">
          <dl className="divide-y divide-slate-200">
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-slate-500">Comercio destino</dt>
              <dd className="font-mono" title={payload.destination}>
                {shortKey(payload.destination)}
              </dd>
            </div>
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-slate-500">Monto a pagar</dt>
              <dd>
                {payload.amount} {payload.asset}
              </dd>
            </div>
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-slate-500">Concepto</dt>
              <dd>{payload.memo || '—'}</dd>
            </div>
            {!isLoyaltyAsset(payload.asset) ? (
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-slate-500">Puntos que ganarás</dt>
                <dd>
                  {points} {stellarConfig.loyalty.code}
                </dd>
              </div>
            ) : null}
          </dl>

          <div className="flex gap-3">
            <button
              type="button"
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm"
              onClick={() => {
                handlingRef.current = false
                setPayload(null)
              }}
            >
              Volver a escanear
            </button>
            <button
              type="button"
              className="flex-1 rounded-xl bg-blue-600 text-white py-2.5 text-sm font-medium disabled:opacity-60"
              onClick={() => void onConfirm()}
              disabled={submitting}
            >
              {submitting ? 'Enviando…' : 'Confirmar Pago'}
            </button>
          </div>
        </div>
      ) : null}

      {!payload && scanError ? (
        <p className="text-sm text-red-600">{scanError}</p>
      ) : null}

      {status ? <p className="text-sm text-slate-600 break-all">{status}</p> : null}
    </div>
  )
}

async function stopScanner(scanner: Html5Qrcode) {
  try {
    const state = scanner.getState()
    if (state === 2 || state === 3) {
      await scanner.stop()
    }
  } catch {
    // already stopped
  }
  try {
    scanner.clear()
  } catch {
    // ignore
  }
}
