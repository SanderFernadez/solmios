import { OrmRepository } from 'arckode-framework'
import { dispatchLifecycleEmail } from '../../reservas/usecases/lifecycle-email'
import type { EmailSender } from '../../../services/email-sender'

export function createNoShowCron(orm: any, emailSender: EmailSender, logger: any): () => Promise<number> {
  return async (): Promise<number> => {
    const todayStr = new Date().toISOString().split('T')[0]
    // Antes traía TODAS las reservas de TODOS los hoteles (findMany sin filtro) cada 24h y las
    // descartaba en JS. Solo pending/confirmed pueden ser no-show: se filtran por status en la
    // query (#276). Reduce de "todo el histórico" a las que realmente pueden vencer.
    const [pending, confirmed] = await Promise.all([
      orm.findMany('Reservations', { status: 'pending' }) as Promise<any[]>,
      orm.findMany('Reservations', { status: 'confirmed' }) as Promise<any[]>,
    ])
    const reservas = [...pending, ...confirmed]
    let count = 0
    for (const r of reservas) {
      const ci = String(r.checkIn || '').slice(0, 10)
      if (ci && ci < todayStr) {
        await orm.update('Reservations', r.id, { status: 'no_show' })
        // BUG FIX: liberar la habitación asociada (mismo fix que markNoShows del endpoint) — antes
        // quedaba occupied/reserved y Channex la mostraba fuera de inventario → overbooking.
        if (r.roomId) await orm.update('Rooms', r.roomId, { status: 'available' })
        count++
        dispatchLifecycleEmail(
          { emailSender, guestRepo: new OrmRepository<any>(orm, 'Guests'), roomRepo: new OrmRepository<any>(orm, 'Rooms'), hotelRepo: new OrmRepository<any>(orm, 'Hotels'), messageLogRepo: new OrmRepository<any>(orm, 'MessageLogs'), logger },
          { reservationId: r.id, hotelId: r.hotelId, guestId: r.guestId, roomId: r.roomId, checkIn: r.checkIn, checkOut: r.checkOut, event: 'no_show' },
        ).catch((e: any) => logger.warn('no-show email', { reservationId: r.id, error: (e as Error).message }))
      }
    }
    return count
  }
}
