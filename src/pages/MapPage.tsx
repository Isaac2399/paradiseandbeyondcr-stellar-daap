import { CustomerPlacesMap } from '@/components/map/CustomerPlacesMap'
import { MerchantPlaceEditor } from '@/components/map/MerchantPlaceEditor'
import { useAuth } from '@/lib/auth/AuthContext'

export default function MapPage() {
  const { user, setUser } = useAuth()

  if (!user) {
    return null
  }

  const isMerchant = user.role === 'merchant'

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Mapa</h1>
        <p className="mt-1 text-sm text-app-muted">
          {isMerchant
            ? 'Publica tu local y las promos de ROJOS para que los clientes las vean en el mapa.'
            : user.role === 'admin'
              ? 'Vista de todos los locales publicados.'
              : 'Locales de empresas en Stellar Pay. Filtra por tipo o por promo y toca un pin para ver detalles.'}
        </p>
      </div>

      {isMerchant ? (
        <MerchantPlaceEditor user={user} onSaved={setUser} />
      ) : (
        <CustomerPlacesMap />
      )}
    </section>
  )
}
