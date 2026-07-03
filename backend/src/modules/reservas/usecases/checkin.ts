import { NotFoundError, AuthError, ConflictError } from 'arckode-framework'

export async function checkinValidation(repo: any, id: string, user: any, auth?: any): Promise<any> {
  const hotelId = user?.hotelId
  const r = await repo.findById(id) as any
  if (!r) throw new NotFoundError('Reserva no encontrada')
  if (user.role !== 'super_admin' && r.hotelId !== hotelId) throw new AuthError('No autorizado')
  if (auth) auth.assertOwnership(r, { hotelId })
  if (r.status === 'checked_in') throw new ConflictError('La reserva ya tiene check-in')
  if (!['confirmed', 'pending'].includes(r.status)) throw new ConflictError(`No se puede hacer check-in de una reserva ${r.status}`)
  return { reservation: r, hotelId: r.hotelId }
}

export async function checkoutValidation(repo: any, id: string, user: any, auth?: any): Promise<any> {
  const hotelId = user?.hotelId
  const r = await repo.findById(id) as any
  if (!r) throw new NotFoundError('Reserva no encontrada')
  if (user.role !== 'super_admin' && r.hotelId !== hotelId) throw new AuthError('No autorizado')
  if (auth) auth.assertOwnership(r, { hotelId })
  if (r.status !== 'checked_in') throw new ConflictError(`Solo se puede hacer check-out de una reserva con check-in (actual: ${r.status})`)
  return { reservation: r, hotelId: r.hotelId }
}

export async function executeCheckin(r: any, user: any, deps: {
  orm: any; logger: any; repo: any; queries?: any
}): Promise<any> {
  const nowIso = new Date().toISOString()
  let guestId = r.guestId
  let folioId = ''
  try {
    await deps.orm.transaction(async (tx: any) => {
      if (!guestId) {
        const guestName = r.externalLocator ? `Pasajero ${r.externalLocator}` : 'Pasajero walk-in'
        const guest = await tx.create('Guests', { id: crypto.randomUUID(), name: guestName, hotelId: r.hotelId, active: 1, totalStays: 1, totalSpent: 0, tier: 'bronze', notes: r.otaNotes || null }) as any
        guestId = guest.id
      } else {
        const g = (await tx.findMany('Guests', { id: guestId }))[0] as any
        if (g) await tx.update('Guests', guestId, { totalStays: (Number(g.totalStays) || 0) + 1 })
      }
      folioId = crypto.randomUUID()
      await tx.create('Folios', { id: folioId, hotelId: r.hotelId, reservationId: r.id, guestId, roomId: r.roomId, status: 'open', currency: r.currency || 'USD', invoiceId: null, openedAt: nowIso, closedAt: null })
      await tx.update('Reservations', r.id, { status: 'checked_in', checkedInAt: nowIso, folioId, guestId })
      await tx.update('Rooms', r.roomId, { status: 'occupied' })
    })
  } catch (e: any) {
    throw new Error(`Error interno al procesar check-in: ${e.message}`)
  }
  if (deps.queries) {
    deps.queries.createAuditLog({ id: crypto.randomUUID(), entity: 'Reservations', entityId: r.id, action: 'checkin', userId: user.id, hotelId: r.hotelId, detail: JSON.stringify({ guestId, roomId: r.roomId, folioId, checkIn: r.checkIn, checkOut: r.checkOut }), createdAt: nowIso })
  }
  return { ok: true, reservationId: r.id, status: 'checked_in', folioId, guestId }
}
