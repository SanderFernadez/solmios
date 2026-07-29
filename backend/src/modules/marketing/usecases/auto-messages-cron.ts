const DAY_MS = 86_400_000

/**
 * DT-18: `pre_checkin` es el único trigger de fecha con OFFSET variable por auto-message (los
 * demás triggers de fecha, checkin_day/checkout_day, siempre son offset=0 → "hoy"). Por eso no
 * se puede resolver con una sola query: hay que agrupar los auto-messages activos de
 * `pre_checkin` por su `triggerOffset` y, para cada offset distinto, buscar las reservas cuyo
 * checkIn caiga exactamente ese día. Antes de este fix, `pre_checkin` estaba en el enum del
 * schema (validators/schema.ts) pero NINGÚN código lo disparaba — un hotel podía configurarlo
 * y nunca se enviaba nada.
 */
async function firePreCheckin(orm: any, hotelId: string, today: Date, marketingModule: { triggerAutoMessages: (params: any) => Promise<void> }): Promise<void> {
  const msgs = await orm.findMany('AutoMessages', { hotelId, triggerEvent: 'pre_checkin', isActive: 1 }) as any[]
  if (msgs.length === 0) return
  const offsets = [...new Set(msgs.map((m) => Number(m.triggerOffset || 0)))]
  for (const offset of offsets) {
    const target = new Date(today.getTime() + offset * DAY_MS)
    const targetStr = target.toISOString().split('T')[0]
    const reservations = await orm.findMany('Reservations', { hotelId, checkIn: targetStr, status: 'confirmed' }) as any[]
    for (const r of reservations) {
      await marketingModule.triggerAutoMessages({
        hotelId, event: 'pre_checkin', reservationId: r.id, guestId: r.guestId, roomId: r.roomId,
        variables: { checkin_date: r.checkIn, checkout_date: r.checkOut, locator: r.externalLocator || r.id.slice(-8) },
      }).catch(() => {})
    }
  }
}

export function createAutoMessagesCron(orm: any, marketingModule: { triggerAutoMessages: (params: any) => Promise<void> }): () => Promise<void> {
  return async () => {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const hotels = await orm.findMany('Hotels', {}) as any[]

    for (const hotel of hotels) {
      const checkinToday = await orm.findMany('Reservations', { hotelId: hotel.id, checkIn: todayStr, status: 'confirmed' }) as any[]
      for (const r of checkinToday) {
        await marketingModule.triggerAutoMessages({
          hotelId: hotel.id, event: 'checkin_day', reservationId: r.id, guestId: r.guestId, roomId: r.roomId,
          variables: { checkin_date: r.checkIn, checkout_date: r.checkOut, locator: r.externalLocator || r.id.slice(-8) },
        }).catch(() => {})
      }

      const checkoutToday = await orm.findMany('Reservations', { hotelId: hotel.id, checkOut: todayStr, status: 'checked_in' }) as any[]
      for (const r of checkoutToday) {
        await marketingModule.triggerAutoMessages({
          hotelId: hotel.id, event: 'checkout_day', reservationId: r.id, guestId: r.guestId, roomId: r.roomId,
          variables: { checkin_date: r.checkIn, checkout_date: r.checkOut, locator: r.externalLocator || r.id.slice(-8) },
        }).catch(() => {})
      }

      await firePreCheckin(orm, hotel.id, today, marketingModule).catch(() => {})
    }
  }
}
