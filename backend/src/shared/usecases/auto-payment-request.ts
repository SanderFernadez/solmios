import { safeParse } from '../utils/safe-parse'

export async function handleReservationCreated(orm: any, r: any): Promise<void> {
  orm.create('Auditlog', {
    id: crypto.randomUUID(), hotelId: r.hotelId || null, entity: 'Reservations', entityId: r.id, action: 'create',
    userId: null, userName: 'system (auto)', detail: JSON.stringify({ status: r.status, totalAmount: r.totalAmount, roomId: r.roomId }),
  }).catch(() => {})
  try {
    const cfg = (await orm.findMany('Configuration', { hotelId: r.hotelId, key: 'automation_config' }))[0] as any
    const auto = cfg ? safeParse(cfg.value) : {}
    if (!auto?.autoPaymentRequest) return
    const pending = Math.max(0, Number(r.totalAmount || 0) - Number(r.deposit || 0))
    if (pending <= 0) return
    const existing = await orm.findMany('PaymentRequests', { reservationId: r.id }) as any[]
    if (existing.some((p: any) => p.status === 'pending')) return
    await orm.create('PaymentRequests', {
      id: crypto.randomUUID(), hotelId: r.hotelId, reservationId: r.id,
      amount: pending, currency: r.currency || 'USD', status: 'pending', sentTo: '', sentVia: 'email',
    })
  } catch (e) {
    // fire-and-forget
  }
}

export async function handleReservationUpdated(orm: any, r: any): Promise<void> {
  orm.create('Auditlog', {
    id: crypto.randomUUID(), hotelId: r.hotelId || null, entity: 'Reservations', entityId: r.id, action: 'update',
    userId: null, userName: 'system (auto)', detail: JSON.stringify({ status: r.status, totalAmount: r.totalAmount }),
  }).catch(() => {})
}

export async function handleReservationDeleted(orm: any, id: string): Promise<void> {
  orm.create('Auditlog', {
    id: crypto.randomUUID(), hotelId: null, entity: 'Reservations', entityId: id, action: 'delete',
    userId: null, userName: 'system (auto)', detail: null,
  }).catch(() => {})
}
