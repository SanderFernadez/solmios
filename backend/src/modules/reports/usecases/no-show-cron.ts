import { OrmRepository } from 'arckode-framework'
import { dispatchLifecycleEmail } from '../../reservas/usecases/lifecycle-email'
import type { EmailSender } from '../../../services/email-sender'

export function createNoShowCron(orm: any, emailSender: EmailSender, logger: any): () => Promise<number> {
  return async (): Promise<number> => {
    const todayStr = new Date().toISOString().split('T')[0]
    const reservas = (await orm.findMany('Reservations', {})) as any[]
    let count = 0
    for (const r of reservas) {
      const ci = String(r.checkIn || '').slice(0, 10)
      if ((r.status === 'pending' || r.status === 'confirmed') && ci && ci < todayStr) {
        await orm.update('Reservations', r.id, { status: 'no_show' })
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
