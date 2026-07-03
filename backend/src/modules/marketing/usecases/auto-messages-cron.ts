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
    }
  }
}
