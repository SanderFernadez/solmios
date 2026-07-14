// cash/usecases/list.ts — Listado paginado de movimientos con caché versionada.
// Extraído del service para dejarlo bajo 200 líneas (no God Object) al sumar el audit log (SC-05).
//
// La caché se invalida bumpeando `version` (las claves llevan filtros + paginación, y el
// CacheAdapter no borra por prefijo). Sin `from`/`to` el repo pagina; con rango de fechas hay que
// traer y filtrar en memoria porque el adapter no expresa comparaciones.

import type { RepositoryAdapter, CacheAdapter } from 'arckode-framework'
import type { CashMovementDTO, MovementQuery, CashPaginated } from '../types'

export interface ListDeps {
  repo: RepositoryAdapter<CashMovementDTO>
  cache: CacheAdapter
  version: number
}

function filtersOf(hotelId: string, query: MovementQuery): Record<string, unknown> {
  const filters: Record<string, unknown> = { hotelId: hotelId || '__none__' }
  if (query.shiftId) filters.shiftId = query.shiftId
  if (query.type) filters.type = query.type
  if (query.method) filters.method = query.method
  return filters
}

export async function listMovements(deps: ListDeps, hotelId: string, query: MovementQuery): Promise<CashPaginated> {
  const { repo, cache } = deps
  const page = Math.max(query.page || 1, 1)
  const limit = Math.min(Math.max(query.limit || 20, 1), 100)
  const offset = (page - 1) * limit

  const cacheKey = `caja:mov:v${deps.version}:${hotelId}:${JSON.stringify(query || {})}`
  const cached = await cache.get(cacheKey)
  if (cached) return cached as CashPaginated

  const filters = filtersOf(hotelId, query)
  let response: CashPaginated

  if (query.from || query.to) {
    let rows = await repo.findMany(filters)
    if (query.from) rows = rows.filter(r => (r.createdAt || '') >= query.from!)
    if (query.to) rows = rows.filter(r => (r.createdAt || '') <= query.to! + 'T23:59:59')
    const total = rows.length
    response = {
      data: rows.slice(offset, offset + limit), total, limit, offset,
      pages: Math.ceil(total / limit) || 1, hasNext: offset + limit < total, hasPrev: page > 1,
    }
  } else {
    const result = await repo.paginate(filters, { limit, offset })
    response = {
      data: result.data, total: result.total, limit, offset,
      pages: result.pages, hasNext: offset + limit < result.total, hasPrev: page > 1,
    }
  }

  await cache.set(cacheKey, response, 300)
  return response
}
