import { NotFoundError, AuthError } from 'arckode-framework'
import type { ReservasQueries } from './reservas-queries'

export async function getExtendedDetail(repo: any, guestRepo: any, roomRepo: any, queries: ReservasQueries, id: string, currentUser: any): Promise<any> {
  const r = await repo.findById(id) as any
  if (!r) throw new NotFoundError('Reserva no encontrada')
  const hid = currentUser?.hotelId
  if (currentUser?.role !== 'super_admin' && r.hotelId !== hid) throw new AuthError('No autorizado')
  const [guest, room, companions, lockCodes, payments, addons] = await Promise.all([
    r.guestId ? guestRepo.findById(r.guestId) : Promise.resolve(null),
    r.roomId ? roomRepo.findById(r.roomId) : Promise.resolve(null),
    queries.getCompanions(r.id),
    queries.getLockCodes(r.id),
    queries.getPaymentRequests(r.id),
    queries.getReservationAddons(r.id),
  ])
  const CARD_FIELDS = ['cardHolder', 'cardBrand', 'cardLast4', 'cardExpMonth', 'cardExpYear']
  const safeReservation = Object.fromEntries(Object.entries(r).filter(([k]) => !CARD_FIELDS.includes(k)))
  return { ...safeReservation, hasGuaranteeCard: !!(r.hasGuaranteeCard || r.cardLast4), guest: guest || null, room: room || null, companions, lockCodes, payments, addons, checkinCode: String(r.id).replace(/-/g, '').slice(0, 12), pendingAmount: Math.max(0, (r.totalAmount || 0) - (r.deposit || 0)) }
}

export async function getAuditTrail(repo: any, queries: ReservasQueries, id: string, currentUser: any): Promise<any[]> {
  const r = await repo.findById(id) as any
  if (!r) throw new NotFoundError('Reserva no encontrada')
  const hid = currentUser?.hotelId; const role = currentUser?.role
  if (role !== 'super_admin' && r.hotelId !== hid) throw new AuthError('No autorizado')
  const logs = await queries.getAuditLogs('Reservations', id)
  return logs.filter((l: any) => role === 'super_admin' || l.hotelId === r.hotelId || l.hotelId === 'unknown').sort((a: any, b: any) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
}
