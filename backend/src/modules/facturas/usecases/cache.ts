// facturas/usecases/cache.ts — Invalidación de caché tras mutaciones.
// Borra listado + stats para que las tarjetas de contabilidad muestren datos
// tiempo-real tras crear/pagar/actualizar/borrar (antes solo se invalidaba el list,
// por lo que "Ingresos del mes" / "Pendiente" quedaban stale hasta 120s).

import type { CacheAdapter } from 'arckode-framework'

export async function invalidateFacturasCaches(cache: CacheAdapter, hotelId?: string): Promise<void> {
  const s = hotelId || 'all'
  await cache.delete('facturas:list:' + s)
  await cache.delete('facturas:stats:' + s)
}
