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

export async function createReservation(repo: any, blockRepo: any | undefined, logger: any, cache: any, sockets: any, notifyDeps: any, dto: CreateReservasDTO, currentUser: { id: string; role: string; hotelId?: string }, roomRepo?: any, guestRepo?: any, dateRestrictionRepo?: any): Promise<ReservasDTO> {
  if (currentUser.role !== 'super_admin' && dto.hotelId !== currentUser.hotelId) throw new AuthError('No autorizado para crear en otro hotel')
  // El estado inicial no puede ser checked_in/checked_out/etc: esos se logran vía /checkin y
  // /checkout (que crean folio y ocupan el cuarto). Una reserva nace confirmada o pendiente.
  if (dto.status && dto.status !== 'confirmed' && dto.status !== 'pending') {
    throw new ConflictError(`Estado inicial no permitido: ${dto.status} (usar confirmed o pending)`)
  }
  // IDOR: el cuarto y el huésped deben ser del MISMO hotel que la reserva. Sin esto, un hotel
  // ocupaba/cobraba cuartos de otro pasando un roomId ajeno (el hotelId ya se forzó arriba).
  // Se lee por `findOne({id})` — la pertenencia es lo que se está verificando, no un recurso
  // protegido que requiera assertOwnership del usuario sobre él.
  if (roomRepo) {
    const room = await roomRepo.findOne({ id: dto.roomId })
    if (!room || room.hotelId !== dto.hotelId) throw new ConflictError('La habitación no pertenece a este hotel')
  }
  if (guestRepo && dto.guestId) {
    const guest = await guestRepo.findOne({ id: dto.guestId })
    if (!guest || guest.hotelId !== dto.hotelId) throw new ConflictError('El huésped no pertenece a este hotel')
  }
  if (dto.checkIn >= dto.checkOut) throw new ConflictError('checkIn debe ser anterior a checkOut')
  // Estadía mínima por fecha (fila "Días Mínimos" del planning). Solo se persisten overrides (minStay>1);
  // sin fila para la fecha de entrada, el mínimo es 1 noche. Lee la tabla compartida DateRestrictions —
  // sin importar el módulo pricing (aislamiento de módulos), igual que blockRepo con RoomBlocks.
  if (dateRestrictionRepo) {
    const nights = Math.round((new Date(dto.checkOut).getTime() - new Date(dto.checkIn).getTime()) / 86_400_000)
    const row = (await dateRestrictionRepo.findMany({ hotelId: dto.hotelId, date: dto.checkIn }))[0] as any
    const minStay = row && Number(row.minStay) > 1 ? Math.floor(Number(row.minStay)) : 1
    if (nights < minStay) throw new ConflictError(`Estadía mínima para el ${dto.checkIn}: ${minStay} noche(s)`)
  }
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

/** Devuelve la reserva borrada (SC-05: el service la necesita para el audit log). */
export async function deleteReservation(repo: any, logger: any, cache: any, sockets: any, id: string, currentUser: { id: string; role: string; hotelId?: string }): Promise<any> {
  const existing = await repo.findById(id)
  if (!existing) throw new NotFoundError('Reserva no encontrada')
  if (currentUser.role !== 'super_admin' && existing.hotelId !== currentUser.hotelId) throw new AuthError('No autorizado')
  // Una reserva con folio/check-in no se borra: el FK lo frena, pero como 500 de motor. Se mapea a
  // un 409 claro (regla "anular ≠ borrar": cancelar la reserva, no eliminar el registro).
  let deleted: boolean
  try {
    deleted = await repo.delete(id)
  } catch (e) {
    if (/FOREIGN KEY|constraint/i.test((e as Error).message)) {
      throw new ConflictError('No se puede eliminar una reserva con folio o check-in: cancelala en su lugar')
    }
    throw e
  }
  if (!deleted) throw new NotFoundError('Reserva no encontrada')
  await safeEmit(logger, 'onReservasDeleted', sockets.onReservasDeleted, id)
  // Invalidación versionada (de la rama, consistente con create/update). Se MANTIENE `return
  // existing`: el service lo necesita para el audit log del borrado (SC-05).
  await invalidateReservasCaches(cache, existing.hotelId)
  return existing
}
