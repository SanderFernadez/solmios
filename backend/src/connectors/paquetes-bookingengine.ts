// connectors/paquetes-bookingengine.ts — Wire: paquetes (Ofertas) → bookingengine (Upsells)
//
// FIX 2026-07-31 — hallazgo de QA en producción: "Ofertas" (panel → Configuración →
// Promociones, módulo `paquetes`, tabla `packages`) y "Upsells" (lo que el step de Extras
// del widget público realmente lee, `bookingengine/usecases/public-upsells.ts`, tabla
// `upsells`) eran DOS CATÁLOGOS SIN NINGUNA RELACIÓN. Un merchant cargaba un servicio
// adicional en Ofertas, se guardaba perfecto (201, sobrevive reload), pero el widget seguía
// mostrando "No extras available" — el copy de la pantalla ("servicios adicionales para
// ofrecer a tus huéspedes") prometía algo que el código no cumplía.
//
// Alcance de la sync: SOLO `type='servicio'` (extras sueltos). `type='combo'` (habitación +
// extras empaquetados) es un concepto de venta distinto — no tiene un mapeo 1:1 razonable a
// "upsell durante el checkout online" y se deja fuera a propósito.
import type { ConnectorContext } from 'arckode-framework'

interface PaquetesModule {
  setSockets: (s: {
    onPaquetesCreated?: (data: PackageEvent) => Promise<void>
    onPaquetesUpdated?: (data: PackageEvent) => Promise<void>
    onPaquetesDeleted?: (id: string) => Promise<void>
  }) => void
}

interface BookingengineModule {
  syncUpsellFromPackage: (pkg: { id: string; hotelId: string; name: string; description?: string | null; price: number; active?: number | boolean }) => Promise<void>
  removeSyncedUpsell: (packageId: string) => Promise<void>
}

interface PackageEvent {
  id: string
  hotelId: string
  name: string
  description?: string
  type?: string
  price: number
  active?: number
}

export function paquetesBookingengineConnector(ctx: ConnectorContext): void {
  const paquetes = ctx.resolveModule<PaquetesModule>('paquetes')
  const bookingengine = ctx.resolveModule<BookingengineModule>('bookingengine')

  paquetes.setSockets({
    onPaquetesCreated: async (pkg) => {
      if (pkg.type !== 'servicio') return
      await bookingengine.syncUpsellFromPackage(pkg)
    },
    onPaquetesUpdated: async (pkg) => {
      // Si dejó de ser 'servicio' (editaron el type a 'combo'), el espejo en Upsells ya no
      // corresponde — se borra en vez de dejarlo huérfano mostrando datos viejos.
      if (pkg.type !== 'servicio') {
        await bookingengine.removeSyncedUpsell(pkg.id)
        return
      }
      await bookingengine.syncUpsellFromPackage(pkg)
    },
    onPaquetesDeleted: async (id) => {
      await bookingengine.removeSyncedUpsell(id)
    },
  })
}
