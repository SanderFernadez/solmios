export async function getDashboardData(orm: any, auth: any | null, hotelId: string, user?: any): Promise<any> {
  if (!orm) throw new Error('ORM no disponible')
  const [hotel, rooms] = await Promise.all([
    orm.findById('Hotels', hotelId),
    orm.findMany('Rooms', { hotelId }),
  ])
  if (auth) auth.assertOwnership(hotel, user)
  const typeMap = new Map<string, any>()
  for (const r of rooms as any[]) {
    const t = r.type || 'standard'
    if (!typeMap.has(t)) typeMap.set(t, { type: t, price: r.basePrice, count: 0 })
    typeMap.get(t)!.count++
  }
  const roomTypes = [...typeMap.values()] as any[]
  const now = new Date(); const m = String(now.getMonth() + 1).padStart(2, '0')
  const direct = (await orm.findMany('Reservations', { hotelId, source: 'booking_engine' })) as any[]
  const monthly = direct.filter((r: any) => r.createdAt && String(r.createdAt).slice(0, 7) === `${now.getFullYear()}-${m}`)
  return { hotel, roomTypes, directMonth: monthly.length, directTotal: direct.length }
}
