import { NotFoundError } from 'arckode-framework'

export async function findReservationByHash(orm: any, hash: string): Promise<any> {
  if (!orm) return null
  const reservas = await orm.findMany('Reservations', {}) as any[]
  return reservas.find((r: any) => String(r.id).replace(/-/g, '').slice(0, 12) === hash || r.id === hash)
}

export async function getPreCheckinData(hash: string, hotelRepo: any, roomRepo: any, guestRepo: any, orm?: any): Promise<any> {
  const reservation = await findReservationByHash(orm, hash)
  if (!reservation) throw new NotFoundError('Reserva no encontrada')
  const today = new Date().toISOString().split('T')[0]
  if (reservation.checkOut && String(reservation.checkOut).slice(0, 10) < today) throw new NotFoundError('Esta reserva ya expiró')
  const hotels = await hotelRepo.findMany({ id: reservation.hotelId }) as any[]
  const hotel = hotels?.[0] as any
  const rooms = await roomRepo.findMany({ id: reservation.roomId }) as any[]
  const room = rooms?.[0] as any
  const guests = reservation.guestId ? await guestRepo.findMany({ id: reservation.guestId }) as any[] : []
  const guest = guests?.[0] as any
  return { id: reservation.id, reservationId: reservation.id, hash, hotelName: hotel?.name || '', roomNumber: room?.number || '', checkIn: reservation.checkIn, checkOut: reservation.checkOut, guestName: guest?.name || '', email: guest?.email || '' }
}

export async function submitPreCheckin(hash: string, body: any, orm: any, guestRepo: any): Promise<void> {
  const reservation = await findReservationByHash(orm, hash)
  if (!reservation) throw new NotFoundError('Reserva no encontrada')
  if (reservation.guestId) {
    await guestRepo.update(reservation.guestId, { name: body.name || body.guestName || undefined, email: body.email || undefined, phone: body.phone || undefined, documentType: body.documentType || undefined, document: body.document || body.documentNumber || undefined, nationality: body.nationality || undefined, birthDate: body.birthDate || undefined })
  }
  if (body.companions?.length) {
    for (const c of body.companions) {
      await orm.create('Companions', { id: crypto.randomUUID(), reservationId: reservation.id, name: c.name, documentNumber: c.documentNumber || '' })
    }
  }
}
