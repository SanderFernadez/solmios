// housekeeping/usecases/cache.ts — Claves e invalidación del listado de tareas.
//
// La clave del listado incluye filtros y paginación: `housekeeping:list:<hotelId>`
// a secas hacía que la primera consulta (sin filtros) cachease las tareas de TODO
// el hotel, y que `?staffId=<camarera>` recibiera esa misma lista. Cada camarera
// veía "Mis Tareas" con las habitaciones de las demás.
//
// `CacheAdapter` no borra por prefijo — solo `delete(key)` exacto —, así que
// invalidar es cambiar un token de versión: las entradas viejas quedan huérfanas
// y expiran por TTL. Mismo patrón que `facturas/usecases/cache.ts`.

import type { CacheAdapter } from 'arckode-framework'

/** El token de versión debe sobrevivir a cualquier entrada que dependa de él. */
const VERSION_TTL_SECONDS = 3600

/** El super_admin puede no tener hotel: sus entradas viven bajo 'all'. */
type HotelKey = string | null | undefined

const versionKey = (hotelId?: HotelKey) => `housekeeping:ver:${hotelId || 'all'}`

async function currentVersion(cache: CacheAdapter, hotelId?: HotelKey): Promise<number> {
  const v = await cache.get<number>(versionKey(hotelId))
  if (v) return v
  const seed = Date.now()
  await cache.set(versionKey(hotelId), seed, VERSION_TTL_SECONDS)
  return seed
}

/** Clave del listado: versión + hotel + filtros + página. */
export async function listCacheKey(
  cache: CacheAdapter,
  hotelId: HotelKey,
  filters: Record<string, unknown>,
  page: number,
  limit: number,
): Promise<string> {
  const version = await currentVersion(cache, hotelId)
  return `housekeeping:list:${hotelId || 'all'}:v${version}:${JSON.stringify(filters)}:${page}:${limit}`
}

/** Tras crear, asignar, iniciar o terminar una tarea: el listado quedó viejo. */
export async function bumpListVersion(cache: CacheAdapter, hotelId?: HotelKey): Promise<void> {
  await cache.set(versionKey(hotelId), Date.now(), VERSION_TTL_SECONDS)
}
