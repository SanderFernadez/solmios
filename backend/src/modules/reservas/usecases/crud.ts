import { NotFoundError, AuthError, ConflictError } from 'arckode-framework'
import { assertRoomAvailable } from './availability'
import { assertUpdateValidations } from './validate-update'
import { safeEmit } from './safe-emit'
import { reservasListCacheKey, invalidateReservasCaches } from './cache'
import type { ReservasDTO, CreateReservasDTO, UpdateReservasDTO, ReservasQuery, ReservasPaginated } from '../types'

const CACHE_TTL = 300
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export async function listReservations(repo: any, userRepo: any, cache: any, logger: any, query: ReservasQuery, currentUser: { id: string; role: string; hotelId?: string }): Promise<ReservasPaginated> {
  const filters: Record<string, unknown> = {}
  if (query.status) filters.status = query.status
  if (query.channel) filters.channel = query.channel
  if (query.roomId) filters.roomId = query.roomId
  if (query.guestId) filters.guestId = query.guestId
  let hotelId = currentUser.hotelId
  if (!hotelId && currentUser.role !== 'super_admin') {
    const user = await userRepo.findById(currentUser.id)
    hotelId = user?.hotelId
  }
  if (currentUser.role !== 'super_admin') {
    if (!hotelId) throw new AuthError('No hotel assigned')
    filters.hotelId = hotelId
  } else if (query.hotelId) {
    filters.hotelId = query.hotelId
  }
  const page = Math.max(query.page || 1, 1)
  const limit = Math.min(Math.max(query.limit || DEFAULT_LIMIT, 1), MAX_LIMIT)
  const offset = (page - 1) * limit
  const cacheKey = await reservasListCacheKey(cache, hotelId, { filters, page, limit, search: query.search })
  const cached = await cache.get(cacheKey)
  if (cached) return cached as ReservasPaginated
  const result = query.search
    ? await repo.paginate({ ...filters, externalLocator: { $like: `%${query.search}%` } }, { offset, limit })
    : await repo.paginate(filters, { offset, limit })
  const response: ReservasPaginated = { data: result.data, total: result.total, page, limit, pages: Math.ceil(result.total / limit) }
  await cache.set(cacheKey, response, CACHE_TTL)
  return response
}

export async function getReservationById(repo: any, id: string, currentUser: { id: string; role: string; hotelId?: string }): Promise<ReservasDTO> {
  const item = await repo.findById(id)
  if (!item) throw new NotFoundError('Reserva no encontrada')
  if (currentUser.role !== 'super_admin' && item.hotelId !== currentUser.hotelId) throw new AuthError('No autorizado')
  return item
}

export async function createReservation(repo: any, blockRepo: any | undefined, logger: any, cache: any, sockets: any, notifyDeps: any, dto: CreateReservasDTO, currentUser: { id: string; role: string; hotelId?: string }): Promise<ReservasDTO> {
  if (currentUser.role !== 'super_admin' && dto.hotelId !== currentUser.hotelId) throw new AuthError('No autorizado para crear en otro hotel')
  if (dto.checkIn >= dto.checkOut) throw new ConflictError('checkIn debe ser anterior a checkOut')
  await assertRoomAvailable(repo, dto.roomId, dto.checkIn, dto.checkOut)
  if (blockRepo) {
    const blocks = await blockRepo.findMany({ roomId: dto.roomId, hotelId: dto.hotelId })
    for (const block of blocks as any[]) {
      if (dto.checkIn <= block.endDate && dto.checkOut >= block.startDate) throw new ConflictError(`Habitación bloqueada del ${block.startDate} al ${block.endDate}: ${block.reason || 'Sin motivo'}`)
    }
  }
  const item = await repo.create(dto as any)
  await safeEmit(logger, 'onReservasCreated', sockets.onReservasCreated, item)
  await invalidateReservasCaches(cache, dto.hotelId)
  return item
}

export async function updateReservation(repo: any, logger: any, cache: any, sockets: any, id: string, dto: UpdateReservasDTO, currentUser: { id: string; role: string; hotelId?: string }): Promise<ReservasDTO> {
  const existing = await repo.findById(id)
  if (!existing) throw new NotFoundError('Reserva no encontrada')
  if (currentUser.role !== 'super_admin' && existing.hotelId !== currentUser.hotelId) throw new AuthError('No autorizado')
  await assertUpdateValidations(repo, existing, dto, currentUser, id)
  const item = await repo.update(id, dto as any)
  if (!item) throw new NotFoundError('Reserva no encontrada')
  await safeEmit(logger, 'onReservasUpdated', sockets.onReservasUpdated, item)
  await invalidateReservasCaches(cache, existing.hotelId)
  return item
}

export async function deleteReservation(repo: any, logger: any, cache: any, sockets: any, id: string, currentUser: { id: string; role: string; hotelId?: string }): Promise<void> {
  const existing = await repo.findById(id)
  if (!existing) throw new NotFoundError('Reserva no encontrada')
  if (currentUser.role !== 'super_admin' && existing.hotelId !== currentUser.hotelId) throw new AuthError('No autorizado')
  const deleted = await repo.delete(id)
  if (!deleted) throw new NotFoundError('Reserva no encontrada')
  await safeEmit(logger, 'onReservasDeleted', sockets.onReservasDeleted, id)
  await invalidateReservasCaches(cache, existing.hotelId)
}
