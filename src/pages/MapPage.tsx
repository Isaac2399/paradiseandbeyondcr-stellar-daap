import { MapPin } from 'lucide-react'
import { useAuth } from '@/lib/auth/AuthContext'

export default function MapPage() {
  const { user } = useAuth()
  const horizon = 'https://stellar.expert/explorer/testnet'
  const accountUrl = user
    ? `${horizon}/account/${user.publicKey}`
    : horizon

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Mapa</h1>
        <p className="mt-1 text-sm text-app-muted">
          Explorador de cuentas y actividad en Testnet.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-[24px] bg-app-card">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,#2a2a12,transparent_45%),radial-gradient(circle_at_80%_80%,#1a2a1a,transparent_40%)]" />
        <div className="relative grid min-h-64 place-items-center p-8 text-center">
          <MapPin className="mb-3 h-10 w-10 text-app-accent" />
          <p className="text-sm text-white/80">
            Vista de mapa en construcción. Mientras tanto puedes abrir tu cuenta
            en Stellar Expert.
          </p>
        </div>
      </div>

      <a
        href={accountUrl}
        target="_blank"
        rel="noreferrer"
        className="block rounded-2xl bg-app-card px-4 py-3 text-center text-sm font-medium text-app-accent"
      >
        Ver cuenta en el explorador
      </a>
    </section>
  )
}
