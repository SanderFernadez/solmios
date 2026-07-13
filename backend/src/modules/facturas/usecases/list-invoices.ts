// facturas/usecases/list-invoices.ts — Listado paginado con filtros, enriquecido y cacheado.
// Extraído del service para mantenerlo < 200 líneas.

import type { RepositoryAdapter, CacheAdapter, Logger } from 'arckode-framework'
import { AuthError } from 'arckode-framework'
import type { FacturasDTO, FacturasQuery, FacturasListResult, CurrentUser } from '../types'
import { enrichInvoice, type EnrichDeps } from './billing'
import { attachItems } from './invoice-items'
import { facturasListCacheKey } from './cache'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100
const LIST_TTL_SECONDS = 300

export interface ListInvoicesDeps {
  repo: RepositoryAdapter<FacturasDTO>
  itemRepo: RepositoryAdapter<any>
  cache: CacheAdapter
  logger: Logger
  enrichDeps: EnrichDeps
}

/** Filtros de la query resueltos contra el usuario (multi-tenant). */
function resolveFilters(query?: FacturasQuery, user?: CurrentUser): Record<string, unknown> {
  const filters: Record<string, unknown> = {}
  if (query?.type) filters.type = query.type
  if (query?.status) filters.status = query.status
  if (user && user.role !== 'super_admin') {
    if (!user.hotelId) throw new AuthError('No hotel assigned')
    filters.hotelId = user.hotelId
  } else if (query?.hotelId) {
    filters.hotelId = query.hotelId
  }
  return filters
}

export async function listInvoices(
  deps: ListInvoicesDeps,
  query?: FacturasQuery,
  user?: CurrentUser,
): Promise<FacturasListResult> {
  const { repo, itemRepo, cache, logger, enrichDeps } = deps
  logger.info('Listando facturas', { query })

  const filters = resolveFilters(query, user)
  const page = Math.max(query?.page || 1, 1)
  const limit = Math.min(Math.max(query?.limit || DEFAULT_LIMIT, 1), MAX_LIMIT)
  const offset = (page - 1) * limit

  // La clave incluye filtros + paginación: antes todas las páginas compartían entrada
  // y la página 2 devolvía la 1 hasta la próxima escritura.
  const cacheKey = await facturasListCacheKey(cache, user?.hotelId, { filters, page, limit, search: query?.search })
  const cached = await cache.get(cacheKey)
  if (cached) return cached as FacturasListResult

  // DT-07: con `search`, el filtro se aplica sobre TODA la tabla filtrada (no una sola página),
  // así un match en cualquier página aparece. El adapter no soporta LIKE (sin SQL crudo en módulos),
  // por eso se trae el conjunto del hotel y se filtra/pagina en memoria. Coste acotado por hotel;
  // la búsqueda es una acción deliberada del usuario (perf profunda: ver PF-01/PF-02).
  if (query?.search) {
    const q = String(query.search).toLowerCase()
    const allRows = await repo.findMany(filters)
    const allData = await Promise.all(allRows.map(async (r) => attachItems(itemRepo, await enrichInvoice(r, enrichDeps))))
    const matched = allData.filter((d) =>
      (d.invoiceNumber || '').toLowerCase().includes(q) ||
      (d.guest || '').toLowerCase().includes(q) ||
      (d.notes || '').toLowerCase().includes(q),
    )
    const pages = Math.max(1, Math.ceil(matched.length / limit))
    const finalResult = {
      data: matched.slice(offset, offset + limit),
      total: matched.length, limit, offset, pages,
      hasNext: page < pages, hasPrev: page > 1,
    }
    await cache.set(cacheKey, finalResult, LIST_TTL_SECONDS)
    return finalResult
  }

  const result = await repo.paginate(filters, { offset, limit })
  const data = await Promise.all(result.data.map(async (r) => attachItems(itemRepo, await enrichInvoice(r, enrichDeps))))
  const pages = Math.ceil(result.total / limit)
  const response = { data, total: result.total, limit, offset, pages, hasNext: page < pages, hasPrev: page > 1 }

  await cache.set(cacheKey, response, LIST_TTL_SECONDS)
  return response
}
