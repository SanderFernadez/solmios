export async function hotelOf(req: any, orm: any): Promise<string | undefined> {
  const q = req?.query || {}
  if (q.hotelId) return q.hotelId as string
  const userHotel = req?.user?.hotelId
  if (userHotel && userHotel !== 'platform') return userHotel as string
  if (req?.user?.id && req?.user?.role !== 'super_admin') {
    const uRows = await orm.findMany('Users', { id: req.user.id })
    const u: any = (uRows as any[])?.[0]
    if (u?.hotelId && u.hotelId !== 'platform') return u.hotelId as string
  }
  return ((await orm.findMany('Hotels', {}))[0] as any)?.id
}
