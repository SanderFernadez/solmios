import { NotFoundError, AuthError } from 'arckode-framework'
import { hashGuaranteePin, verifyGuaranteePin } from '../../../services/guarantee-pin'
import type { ReservasQueries } from './reservas-queries'

export async function setGuaranteePin(queries: ReservasQueries, userRepo: any, user: any, body: any): Promise<{ success: boolean }> {
  const hotelId = await resolveHotelIdForUser(queries, userRepo, user)
  if (!hotelId) throw new AuthError('Hotel no encontrado')
  const { pin } = body as { pin?: string }
  if (!pin || !/^\d{4,8}$/.test(String(pin))) throw new Error('PIN inválido (debe ser de 4 a 8 dígitos)')
  const hash = hashGuaranteePin(String(pin), hotelId)
  await queries.upsertConfiguration(hotelId, 'guarantee_pin', hash)
  return { success: true }
}

export async function getGuaranteeHasPin(queries: ReservasQueries, userRepo: any, user: any): Promise<{ hasPin: boolean }> {
  const hotelId = await resolveHotelIdForUser(queries, userRepo, user)
  if (!hotelId) throw new AuthError('Hotel no encontrado')
  const row = await queries.findConfiguration(hotelId, 'guarantee_pin')
  return { hasPin: !!row }
}

export async function unlockGuaranteeCard(queries: ReservasQueries, repo: any, userRepo: any, reservationId: string, user: any, body: any, auth?: any): Promise<any> {
  const r = await repo.findById(reservationId) as any
  if (!r) throw new NotFoundError('Reserva no encontrada')
  if (auth) auth.assertOwnership(r, { hotelId: r.hotelId })
  const hid = await resolveHotelIdForUser(queries, userRepo, user)
  if (!hid) throw new AuthError('Hotel no encontrado')
  if (r.hotelId !== hid) throw new AuthError('Sin acceso a esta reserva')
  if (!r.hasGuaranteeCard && !r.cardLast4) throw new Error('Esta reserva no tiene tarjeta de garantía')
  const pinRow = await queries.findConfiguration(hid, 'guarantee_pin')
  if (!pinRow?.value) throw new Error('No hay PIN de garantía configurado')
  const { pin } = body as { pin?: string }
  if (!pin || !verifyGuaranteePin(String(pin), hid, String(pinRow.value))) throw new AuthError('PIN incorrecto')
  return { cardHolder: r.cardHolder || '', cardBrand: r.cardBrand || '', cardLast4: r.cardLast4 || '', cardExpMonth: r.cardExpMonth || '', cardExpYear: r.cardExpYear || '' }
}

async function resolveHotelIdForUser(queries: ReservasQueries, userRepo: any, user: any): Promise<string | undefined> {
  if (user?.hotelId && user?.hotelId !== 'platform') return user.hotelId
  if (user?.id && user?.role !== 'super_admin') {
    const rows = await userRepo.findMany({ id: user.id }) as any[]
    const row: any = rows?.[0]
    if (row?.hotelId) return row.hotelId
  }
  const hotels = await queries.findHotels()
  return (hotels[0] as any)?.id
}
