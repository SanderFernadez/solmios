// bookingengine/usecases/upsells-sync.ts — FIX 2026-07-31.
//
// Conecta "Ofertas" (módulo `paquetes`, type='servicio') con "Upsells" (lo que el step de
// Extras del widget público realmente lee, `usecases/public-upsells.ts`). Antes eran
// catálogos sin relación: cargar un servicio adicional en Ofertas no hacía NADA en el widget.
// Llamado por `connectors/paquetes-bookingengine.ts` en los sockets onPaquetesCreated/Updated/
// Deleted — es un sync system-to-system, SIN `user`/ownership: el hotelId ya viene validado
// desde el módulo `paquetes`, que valida ownership en su propio usecase antes de disparar el
// evento. NO exponer estas funciones por HTTP — el CRUD admin real de upsells sigue siendo
// `usecases/upsells-crud.ts` vía el controller, con su propio ownership check.
import type { RepositoryAdapter } from 'arckode-framework'
import type { UpsellDTO } from '../types'

export interface UpsellsSyncDeps {
  upsells: RepositoryAdapter<UpsellDTO>
}

interface PackageForSync {
  id: string
  hotelId: string
  name: string
  description?: string | null
  price: number
  active?: number | boolean
}

/**
 * Upsert idempotente: mismo `id` que el paquete origen (evita una tabla de mapeo aparte).
 * `kind` solo se setea en el alta (default 'per_stay', la única opción sin ambigüedad para un
 * "servicio" genérico sin noción de por-habitación/por-huésped); en updates se preserva por si
 * en el futuro hay una UI de upsells que permita ajustarlo a mano sin que el sync lo pise.
 */
export async function syncUpsellFromPackage(deps: UpsellsSyncDeps, pkg: PackageForSync): Promise<void> {
  const active = pkg.active === undefined ? true : (pkg.active === true || pkg.active === 1)
  const existing = await deps.upsells.findOne({ id: pkg.id })
  if (existing) {
    await deps.upsells.update(pkg.id, {
      name: pkg.name, description: pkg.description ?? null, price: pkg.price, active,
    })
    return
  }
  // `as any` — mismo patrón que usecases/upsells-crud.ts: el ORM completa createdAt/updatedAt
  // server-side (model.ts `timestamps: true`), pero el tipo genérico `Omit<T,'id'>` de
  // RepositoryAdapter no lo sabe.
  await deps.upsells.create({
    id: pkg.id, hotelId: pkg.hotelId, name: pkg.name, description: pkg.description ?? null,
    price: pkg.price, kind: 'per_stay', active, sortOrder: 0,
  } as any)
}

/** Contraparte de `syncUpsellFromPackage`: se llama cuando el paquete se borra, o cuando
 *  cambia de type='servicio' a 'combo' (deja de calificar como upsell). No-op silencioso si
 *  nunca existió el espejo (paquete viejo pre-connector, o siempre fue un combo). */
export async function removeSyncedUpsell(deps: UpsellsSyncDeps, packageId: string): Promise<void> {
  await deps.upsells.delete(packageId).catch(() => {})
}
