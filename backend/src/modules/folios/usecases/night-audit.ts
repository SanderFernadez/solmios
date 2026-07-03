export async function postNightAuditRoomCharges(orm: any, listFolios: any, openFolio: any, postCharge: any, user: any, query?: any): Promise<any> {
  if (!orm) return { posted: 0, error: 'ORM no disponible' }
  let hotelId = query?.hotelId as string || user?.hotelId as string
  if (!hotelId || hotelId === 'platform') {
    const hotels = await orm.findMany('Hotels', {}); const first: any = hotels[0]
    hotelId = first?.id
  }
  if (!hotelId) return { posted: 0, error: 'hotelId requerido' }
  const t = new Date().toISOString().split('T')[0]
  const reservations = await orm.findMany('Reservations', { hotelId }) as any[]
  const rooms = await orm.findMany('Rooms', { hotelId }) as any[]
  const roomById = new Map(rooms.map((r: any) => [r.id, r]))
  const inHouse = reservations.filter((r: any) => r.status === 'checked_in' && r.checkIn && r.checkOut && String(r.checkIn).slice(0, 10) <= t && t <= String(r.checkOut).slice(0, 10))
  let posted = 0
  const mockUser = { id: 'system', role: 'super_admin', hotelId }
  for (const res of inHouse) {
    const room = roomById.get(res.roomId); if (!room) continue
    let folio = (await listFolios({ reservationId: res.id, status: 'open' } as any, mockUser as any)).data?.[0]
    if (!folio) folio = await openFolio({ hotelId, reservationId: res.id, guestId: res.guestId, roomId: res.roomId }, mockUser as any)
    await postCharge(folio.id, { description: `Habitación ${room.number} — ${t}`, category: 'room', amount: Number(room.basePrice) || 0, quantity: 1, source: 'night_audit' }, mockUser as any)
    posted++
  }
  return { posted, date: t }
}
