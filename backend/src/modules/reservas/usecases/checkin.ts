import { NotFoundError, AuthError, ConflictError } from 'arckode-framework'

/**
 * Tasa de impuesto del hotel, para el cargo automático de habitación al check-in.
 *
 * Copia local y no un import de facturas/folios: `reservas` no puede importar otro módulo
 * directo (regla del proyecto — conectores, no imports cruzados), y esta lógica es sencilla.
 * Mismo fallback que facturas/usecases/billing.ts y folios/usecases/folio-math.ts: antes este
 * cargo se posteaba con `taxes: 0` fijo, así que el balance del folio arrancaba sin impuesto
 * desde el primer cargo, ya en el check-in — no era solo un problema de la factura final.
 */
async function taxRateForCheckin(orm: any, hotelId: string): Promise<number> {
  try {
    const rows = await orm.findMany('Configuration', { hotelId, key: 'taxes' })
    const arr: any[] = rows?.[0]?.value ?? []
    const configured = arr.filter((t: any) => t && (t.activo ?? t.active)).reduce((s: number, t: any) => s + Number(t.tasa ?? t.rate ?? 0), 0)
    if (configured > 0) return configured
  } catch { /* cae al fallback */ }
  try {
    const hotel = (await orm.findMany('Hotels', { id: hotelId }))?.[0]
    return Number(hotel?.taxRate) || 0
  } catch {
    return 0
  }
}

export async function checkinValidation(repo: any, id: string, user: any, auth?: any): Promise<any> {
  const hotelId = user?.hotelId
  const r = await repo.findById(id) as any
  if (!r) throw new NotFoundError('Reserva no encontrada')
  if (user.role !== 'super_admin' && r.hotelId !== hotelId) throw new AuthError('No autorizado')
  // assertOwnership recibe (dueño, solicitante, rol, rolAdmin) — todos strings. Pasarle objetos
  // hace que la comparación `===` nunca dé true y lanza Forbidden SIEMPRE: el check-in quedaba muerto.
  if (auth) auth.assertOwnership(r.hotelId, hotelId, user.role, 'super_admin')
  if (r.status === 'checked_in') throw new ConflictError('La reserva ya tiene check-in')
  if (!['confirmed', 'pending'].includes(r.status)) throw new ConflictError(`No se puede hacer check-in de una reserva ${r.status}`)
  return { reservation: r, hotelId: r.hotelId }
}

export async function checkoutValidation(repo: any, id: string, user: any, auth?: any): Promise<any> {
  const hotelId = user?.hotelId
  const r = await repo.findById(id) as any
  if (!r) throw new NotFoundError('Reserva no encontrada')
  if (user.role !== 'super_admin' && r.hotelId !== hotelId) throw new AuthError('No autorizado')
  if (auth) auth.assertOwnership(r.hotelId, hotelId, user.role, 'super_admin')
  if (r.status !== 'checked_in') throw new ConflictError(`Solo se puede hacer check-out de una reserva con check-in (actual: ${r.status})`)
  return { reservation: r, hotelId: r.hotelId }
}

export async function executeCheckin(r: any, user: any, deps: {
  orm: any; logger: any; repo: any; queries?: any
}): Promise<any> {
  const nowIso = new Date().toISOString()
  let guestId = r.guestId
  let folioId = ''

  const room = (await deps.orm.findMany('Rooms', { id: r.roomId }))[0] as any
  const roomRate = Number(room?.basePrice || r.totalAmount || 0)
  const checkInDate = String(r.checkIn).slice(0, 10)
  const taxRate = await taxRateForCheckin(deps.orm, r.hotelId)
  const roomTax = Math.round((roomRate * taxRate / 100 + Number.EPSILON) * 100) / 100

  try {
    await deps.orm.transaction(async (tx: any) => {
      // La estadía se cuenta UNA vez, en el checkout (`CrmService.onCheckoutComplete`), donde también
      // se suma `totalSpent`. Acá se contaba de nuevo: cada huésped sumaba +2 estadías por visita,
      // inflando el `tier` y falseando el `avgPerStay` del LTV (totalSpent / totalStays).
      if (!guestId) {
        const guestName = r.externalLocator ? `Pasajero ${r.externalLocator}` : 'Pasajero walk-in'
        const guest = await tx.create('Guests', { id: crypto.randomUUID(), name: guestName, hotelId: r.hotelId, active: 1, totalStays: 0, totalSpent: 0, tier: 'bronze', notes: r.otaNotes || null }) as any
        guestId = guest.id
      }
      folioId = crypto.randomUUID()
      await tx.create('Folios', { id: folioId, hotelId: r.hotelId, reservationId: r.id, guestId, roomId: r.roomId, status: 'open', currency: r.currency || 'USD', invoiceId: null, openedAt: nowIso, closedAt: null })
      if (roomRate > 0) {
        await tx.create('FolioCharges', {
          id: crypto.randomUUID(), folioId, hotelId: r.hotelId,
          description: `Habitación ${room?.number || ''} — ${checkInDate}`,
          category: 'room', kind: 'charge', quantity: 1,
          amount: roomRate, taxes: roomTax, total: roomRate + roomTax,
          source: 'checkin', postedAt: nowIso,
        })
      }
      await tx.update('Reservations', r.id, { status: 'checked_in', checkedInAt: nowIso, folioId, guestId })
      await tx.update('Rooms', r.roomId, { status: 'occupied' })
    })
  } catch (e: any) {
    throw new Error(`Error interno al procesar check-in: ${e.message}`)
  }
  if (deps.queries) {
    deps.queries.createAuditLog({ id: crypto.randomUUID(), entity: 'Reservations', entityId: r.id, action: 'checkin', userId: user.id, hotelId: r.hotelId, detail: JSON.stringify({ guestId, roomId: r.roomId, folioId, checkIn: r.checkIn, checkOut: r.checkOut, roomCharge: roomRate }), createdAt: nowIso })
  }
  return { ok: true, reservationId: r.id, status: 'checked_in', folioId, guestId, roomCharge: roomRate }
}
