import { useEffect, useRef, useState } from 'react'
import { AccountStrip } from '@/components/dashboard/AccountStrip'
import { DashboardHero } from '@/components/dashboard/DashboardHero'
import { CreateInvoiceQR } from '@/components/merchant/CreateInvoiceQR'
import { ScanAndPay } from '@/components/customer/ScanAndPay'
import { SendByPublicKey } from '@/components/customer/SendByPublicKey'
import { useAuth } from '@/lib/auth/AuthContext'
import { stellarConfig } from '@/lib/stellar/config'
import { useAccountBalances } from '@/lib/stellar/useAccountBalances'

export default function HomePage() {
  const { user } = useAuth()
  const { balances, error } = useAccountBalances(user?.publicKey ?? '')
  const [sendOpen, setSendOpen] = useState(false)
  const sendRef = useRef<HTMLElement>(null)
  const scanRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!sendOpen) {
      return
    }
    sendRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [sendOpen])

  if (!user) {
    return null
  }

  const isCustomer = user.role === 'customer'

  return (
    <div className="space-y-6">
      <DashboardHero
        user={user}
        balances={balances}
        error={error}
        onScan={() =>
          scanRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
        onSend={() => setSendOpen(true)}
      />

      <AccountStrip balances={balances} />

      {sendOpen ? (
        <section
          ref={sendRef}
          id="enviar"
          className="scroll-mt-4 rounded-[24px] bg-app-card p-5"
        >
          <h2 className="mb-2 text-[17px] font-semibold">
            Enviar {stellarConfig.loyalty.code}
          </h2>
          <p className="mb-4 text-sm text-app-muted">
            Transfiere en Testnet a otra public key. El asset por defecto es{' '}
            {stellarConfig.loyalty.code}.
          </p>
          <SendByPublicKey defaultAsset={stellarConfig.loyalty.code} />
        </section>
      ) : null}

      {isCustomer ? (
        <section
          ref={scanRef}
          id="qr"
          className="scroll-mt-4 rounded-[24px] bg-app-card p-5"
        >
          <h2 className="mb-4 text-[17px] font-semibold">Pagar con QR</h2>
          <ScanAndPay />
        </section>
      ) : (
        <section
          ref={scanRef}
          id="cobrar"
          className="scroll-mt-4 rounded-[24px] bg-app-card p-5"
        >
          <h2 className="mb-4 text-[17px] font-semibold">Cobrar / Factura QR</h2>
          <CreateInvoiceQR merchantPublicKey={user.publicKey} />
        </section>
      )}
    </div>
  )
}
