// reservas/usecases/cache.ts — Claves e invalidación de caché tras mutaciones.
//
// El listado se cachea por VERSIÓN, no por clave fija: la clave incluye filtros/page/limit,
// así que `cache.delete('reservas:list:{hotelId}')` (clave sin esos sufijos) nunca coincidía
// con ninguna entrada real — crear/editar/borrar una reserva no invalidaba nada y el listado
// quedaba stale hasta CACHE_TTL (300s). CacheAdapter no ofrece borrado por prefijo — solo
// delete(key) exacto — así que invalidar significa cambiar el token de versión: las entradas
// viejas quedan huérfanas y expiran por TTL. Mismo patrón que facturas/usecases/cache.ts.

import type { CacheAdapter } from 'arckode-framework'

const VERSION_TTL_SECONDS = 3600

type HotelKey = string | null | undefined

const versionKey = (hotelId?: HotelKey) => `reservas:ver:${hotelId || 'all'}`

async function currentVersion(cache: CacheAdapter, hotelId?: HotelKey): Promise<number> {
  const v = await cache.get<number>(versionKey(hotelId))
  if (v) return v
  const seed = Date.now()
  await cache.set(versionKey(hotelId), seed, VERSION_TTL_SECONDS)
  return seed
}

/** Clave del listado: versión + filtros + paginación. Dos queries distintas → dos entradas. */
export async function reservasListCacheKey(
  cache: CacheAdapter,
  hotelId: HotelKey,
  query: { filters: Record<string, unknown>; page: number; limit: number; search?: string },
): Promise<string> {
  const ver = await currentVersion(cache, hotelId)
  const { filters, page, limit, search } = query
  const f = Object.keys(filters).sort().map((k) => `${k}=${String(filters[k])}`).join(',')
  return `reservas:list:${hotelId || 'all'}:v${ver}:${f}:p${page}:l${limit}:s${search ?? ''}`
}

export async function invalidateReservasCaches(cache: CacheAdapter, hotelId?: HotelKey): Promise<void> {
  const s = hotelId || 'all'
  // Bump de versión → invalida TODAS las páginas/filtros cacheados de este hotel.
  await cache.set(versionKey(s), Date.now(), VERSION_TTL_SECONDS)
  // El super_admin lee con hotelId 'all'; sus entradas también quedan obsoletas.
  if (s !== 'all') await cache.set(versionKey('all'), Date.now(), VERSION_TTL_SECONDS)
}
