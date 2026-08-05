// gastos/usecases/cache.ts — Claves e invalidación de caché tras mutaciones.
//
// #652: el listado se versionaba con un contador EN MEMORIA de la instancia (`listVersion++`).
// Bajo más de un proceso (hot-reload de `bun --hot`, restart, escalado horizontal) cada instancia
// arranca su propio contador en 0 mientras el CacheAdapter compartido (Redis en prod) conserva
// entradas viejas: un POST que cae en una instancia bumpea SU contador local pero no invalida las
// claves `v0` que otra instancia (o la misma tras un hot-reload) sigue leyendo — de ahí el
// "creado con 201 pero GET no lo trae" no determinista. Mismo patrón que ya usan facturas/folios:
// el token de versión vive DENTRO de la caché compartida, no en una variable de proceso.

import type { CacheAdapter } from 'arckode-framework'

const VERSION_TTL_SECONDS = 3600

type HotelKey = string | null | undefined

const versionKey = (hotelId?: HotelKey) => `gastos:ver:${hotelId || 'all'}`

async function currentVersion(cache: CacheAdapter, hotelId?: HotelKey): Promise<number> {
  const v = await cache.get<number>(versionKey(hotelId))
  if (v) return v
  const seed = Date.now()
  await cache.set(versionKey(hotelId), seed, VERSION_TTL_SECONDS)
  return seed
}

export async function gastosListCacheKey(cache: CacheAdapter, hotelId: HotelKey, query: unknown): Promise<string> {
  const ver = await currentVersion(cache, hotelId)
  return `gastos:list:${hotelId || 'all'}:v${ver}:${JSON.stringify(query || {})}`
}

/** El super_admin lee con hotelId 'all': sus entradas también quedan obsoletas tras cualquier mutación. */
export async function invalidateGastosCaches(cache: CacheAdapter, hotelId?: HotelKey): Promise<void> {
  const s = hotelId || 'all'
  await cache.set(versionKey(s), Date.now(), VERSION_TTL_SECONDS)
  if (s !== 'all') await cache.set(versionKey('all'), Date.now(), VERSION_TTL_SECONDS)
}
