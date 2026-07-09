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

  const result = await repo.paginate(filters, { offset, limit })
  const data = await Promise.all(result.data.map(async (r) => attachItems(itemRepo, await enrichInvoice(r, enrichDeps))))
  const pages = Math.ceil(result.total / limit)
  const response = { data, total: result.total, limit, offset, pages, hasNext: page < pages, hasPrev: page > 1 }

  let finalResult = response
  if (query?.search) {
    // ⚠ El search filtra la página ya traída, no la tabla: un match en la página 3 no aparece
    // buscando desde la 1. Mover a WHERE del repo cuando el adapter soporte LIKE.
    const q = String(query.search).toLowerCase()
    const filtered = data.filter((d) =>
      (d.invoiceNumber || '').toLowerCase().includes(q) ||
      (d.guest || '').toLowerCase().includes(q) ||
      (d.notes || '').toLowerCase().includes(q),
    )
    finalResult = { data: filtered, total: filtered.length, limit, offset, pages, hasNext: false, hasPrev: page > 1 }
  }

  await cache.set(cacheKey, finalResult, LIST_TTL_SECONDS)
  return finalResult
}
