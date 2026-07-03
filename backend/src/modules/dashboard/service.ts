import type { Logger } from 'arckode-framework'

export class DashboardService {
  constructor(
    private readonly orm: any,
    private readonly logger: Logger,
  ) {}

  private async hotelOf(req: any): Promise<string | undefined> {
    const q = req?.query || {}
    if (q.hotelId) return q.hotelId as string
    const userHotel = req?.user?.hotelId
    if (userHotel && userHotel !== 'platform') return userHotel as string
    if (req?.user?.id && req?.user?.role !== 'super_admin') {
      const uRows = await this.orm.findMany('Users', { id: req.user.id })
      const u: any = uRows?.[0]
      if (u?.hotelId) return u.hotelId
    }
    return ((await this.orm.findMany('Hotels', {}))[0] as any)?.id
  }

  async getDashboard(req: any): Promise<any> {
    const id = await this.hotelOf(req); if (!id) return {}
    const [rooms, res, guests] = await Promise.all([
      this.orm.findMany('Rooms', { hotelId: id }),
      this.orm.findMany('Reservations', { hotelId: id }),
      this.orm.findMany('Guests', { hotelId: id }),
    ])
    const occupied = rooms.filter((r: any) => r.status === 'occupied').length
    const dirty = rooms.filter((r: any) => r.status === 'dirty').length
    const maintenance = rooms.filter((r: any) => r.status === 'out_of_service').length
    const t = new Date().toISOString().split('T')[0]
    const revenueToday = res.filter((r: any) => String(r.checkIn || '').slice(0, 10) === t).reduce((s: number, r: any) => s + (r.totalAmount || 0), 0)
    const checkins = res.filter((r: any) => r.checkIn && String(r.checkIn).slice(0, 10) === t && (r.status === 'confirmed' || r.status === 'checked_in')).length
    const checkouts = res.filter((r: any) => r.checkOut && String(r.checkOut).slice(0, 10) === t && (r.status === 'checked_in' || r.status === 'checked_out')).length
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    const occYesterday = rooms.length ? Math.round((rooms.filter((r: any) => r.status === 'occupied').length / rooms.length) * 100) : 0
    const revYesterday = res.filter((r: any) => String(r.checkIn || '').slice(0, 10) === yesterday).reduce((s: number, r: any) => s + (r.totalAmount || 0), 0)
    const occToday = rooms.length ? Math.round((occupied / rooms.length) * 100) : 0
    return {
      ocupacion: occToday, revenue: res.reduce((s: number, r: any) => s + (r.totalAmount || 0), 0), revenueToday,
      totalRooms: rooms.length, occupied, checkins, checkouts,
      huespedes: guests.length, reservas: res.length, dirty, maintenance,
      roomsByType: rooms.reduce((a: any, r: any) => ((a[r.type] = (a[r.type] || 0) + 1), a), {}),
      roomsByStatus: rooms.reduce((a: any, r: any) => ((a[r.status] = (a[r.status] || 0) + 1), a), {}),
      trends: {
        ocupacion: { value: occYesterday, direction: occToday > occYesterday ? 'up' : occToday < occYesterday ? 'down' : 'stable' },
        revenue: { value: revYesterday, direction: revenueToday > revYesterday ? 'up' : revenueToday < revYesterday ? 'down' : 'stable' },
      },
    }
  }

  async getPlanning(req: any): Promise<any> {
    const id = await this.hotelOf(req); if (!id) return { rooms: [], reservas: [] }
    const [rooms, reservas, guests] = await Promise.all([
      this.orm.findMany('Rooms', { hotelId: id }),
      this.orm.findMany('Reservations', { hotelId: id }),
      this.orm.findMany('Guests', { hotelId: id }),
    ])
    const guestMap = new Map((guests as any[]).map((g: any) => [g.id, g]))
    const roomMap = new Map((rooms as any[]).map((r: any) => [r.id, r]))
    const enriched = (reservas as any[]).map((r: any) => {
      const guest = guestMap.get(r.guestId); const room = roomMap.get(r.roomId)
      const deposit = Number(r.deposit) || 0; const total = Number(r.totalAmount) || 0
      return { ...r, guestName: guest?.name || 'Guest', guestEmail: guest?.email || '', roomNumber: room?.number || '', paymentStatus: deposit >= total && total > 0 ? 'paid' : deposit > 0 ? 'partial' : 'pending' }
    })
    return { rooms, reservas: enriched }
  }

  async getCheckinList(req: any): Promise<any> {
    const id = await this.hotelOf(req)
    const res = await this.orm.findMany('Reservations', { hotelId: id }) as any[]
    const guests = await this.orm.findMany('Guests', { hotelId: id })
    const rooms = await this.orm.findMany('Rooms', { hotelId: id })
    const guestMap = new Map(guests.map((g: any) => [g.id, g]))
    const roomMap = new Map(rooms.map((r: any) => [r.id, r]))
    const t = new Date().toISOString().split('T')[0]
    const checkins = res.filter((r: any) => r.checkIn && String(r.checkIn).slice(0, 10) === t && ['confirmed', 'pending'].includes(r.status))
    const checkouts = res.filter((r: any) => r.checkOut && String(r.checkOut).slice(0, 10) === t && (r.status === 'checked_in' || r.status === 'checked_out'))
    const enrich = (list: any[]) => list.map((r: any) => { const g: any = guestMap.get(r.guestId); const rm: any = roomMap.get(r.roomId); return { ...r, guestName: g?.name || 'Guest', guestEmail: g?.email || '', roomNumber: rm?.number || '' } })
    return { checkins: enrich(checkins), checkouts: enrich(checkouts), pendingCheckins: checkins.length, todayCheckouts: checkouts.length }
  }
}
