import { MS_PER_DAY } from '../helpers'
import type { ReportContext } from '../strategies/types'
import { reportStrategies } from '../strategies'

export class ReportQueries {
  constructor(private readonly orm: any) {}

  async resolveHotelId(req: any): Promise<string | undefined> {
    const q = req?.query || {}
    if (q.hotelId) return q.hotelId as string
    const userHotel = req?.user?.hotelId
    if (userHotel && userHotel !== 'platform') return userHotel as string
    const uRows = await this.orm.findMany('Users', { id: req.user?.id })
    const u: any = (uRows as any[])?.[0]
    if (u?.hotelId) return u.hotelId
    const hotels = await this.orm.findMany('Hotels', {})
    return (hotels as any[])?.[0]?.id
  }

  async getReports(hotelId: string): Promise<any> {
    const [res, rooms, guests] = await Promise.all([
      this.orm.findMany('Reservations', { hotelId }) as Promise<any[]>,
      this.orm.findMany('Rooms', { hotelId }) as Promise<any[]>,
      this.orm.findMany('Guests', { hotelId }) as Promise<any[]>,
    ])
    const totalRevenue = res.reduce((s: number, r: any) => s + (r.totalAmount || 0), 0)
    const byChannel = res.reduce((a: any, r: any) => { const c = r.channel || 'direct'; a[c] = (a[c] || 0) + r.totalAmount; return a }, {})
    const channelBookings = res.reduce((a: any, r: any) => { const c = r.channel || 'direct'; a[c] = (a[c] || 0) + 1; return a }, {})
    const dailyRevenue = Object.entries(res.reduce((a: any, r: any) => { const d = String(r.checkIn).slice(0, 10); if (d) a[d] = (a[d] || 0) + r.totalAmount; return a }, {})).map(([date, value]) => ({ date, value }))
    const occupancyByType = (() => {
      const types: Record<string, { total: number; occupied: number }> = {}
      for (const r of rooms) { if (!types[r.type]) types[r.type] = { total: 0, occupied: 0 }; types[r.type].total++; if (r.status === 'occupied') types[r.type].occupied++ }
      return Object.entries(types).map(([type, d]) => ({ type, ...d, percentage: d.total ? Math.round((d.occupied / d.total) * 100) : 0 }))
    })()
    const channelADRs: Record<string, number> = {}
    for (const [ch, cnt] of Object.entries(channelBookings)) { const rev = (byChannel as any)[ch] || 0; channelADRs[ch] = (cnt as number) > 0 ? Math.round(rev / (cnt as number)) : 0 }
    const today = new Date().toISOString().slice(0, 10)
    const todayCheckins = res.filter((r: any) => r.checkIn && String(r.checkIn).slice(0, 10) === today && (r.status === 'confirmed' || r.status === 'checked_in')).length
    const todayCheckouts = res.filter((r: any) => r.checkOut && String(r.checkOut).slice(0, 10) === today && (r.status === 'checked_in' || r.status === 'checked_out')).length
    return {
      totalRevenue, byChannel, channelBookings, channelADRs,
      totalReservations: res.length, canceledReservations: res.filter((r: any) => r.status === 'cancelled').length,
      dailyRevenue, occupancyByType, todayCheckins, todayCheckouts,
      topGuests: [...guests].sort((a: any, b: any) => (b.totalSpent || 0) - (a.totalSpent || 0)).slice(0, 5).map((g: any) => ({ name: g.name, stays: g.totalStays, totalSpent: g.totalSpent })),
    }
  }

  async getAdvancedReport(hotelId: string, reqQuery: any): Promise<any> {
    const q = reqQuery as any
    const type = String(q.type || 'facturacion')
    const to = String(q.to || new Date().toISOString().slice(0, 10))
    const from = String(q.from || new Date(Date.now() - 30 * MS_PER_DAY).toISOString().slice(0, 10))
    const [reservations, rooms, guests, expenses, folioCharges, blocks, hotel] = await Promise.all([
      this.orm.findMany('Reservations', { hotelId }) as Promise<any[]>,
      this.orm.findMany('Rooms', { hotelId }) as Promise<any[]>,
      this.orm.findMany('Guests', { hotelId }) as Promise<any[]>,
      this.orm.findMany('Expenses', { hotelId }) as Promise<any[]>,
      this.orm.findMany('FolioCharges', { hotelId }) as Promise<any[]>,
      this.orm.findMany('RoomBlocks', { hotelId }) as Promise<any[]>,
      (await this.orm.findMany('Hotels', { id: hotelId }))[0] as any,
    ])
    const inRange = reservations.filter((r: any) => { const ci = String(r.checkIn || '').slice(0, 10); return ci >= from && ci <= to })
    const totalRooms = rooms.length
    const taxRate = Number(hotel?.taxRate || 0) / 100

    const ctx: ReportContext = { from, to, totalRooms, taxRate, reservations: inRange, rooms, guests, expenses, folioCharges, blocks, hotel }
    const strategy = reportStrategies.find(s => s.type === type)
    if (!strategy) throw new Error(`Tipo de reporte desconocido: ${type}`)
    return strategy.execute(ctx)
  }

  async getNightAudit(hotelId: string): Promise<any> {
    const rooms = await this.orm.findMany('Rooms', { hotelId }) as any[]
    const res = await this.orm.findMany('Reservations', { hotelId }) as any[]
    const t = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    const occupied = rooms.filter((r: any) => r.status === 'occupied').length
    const ocupacion = rooms.length ? Math.round((occupied / rooms.length) * 100) : 0
    const revenueTotal = res.reduce((s: number, r: any) => s + (r.totalAmount || 0), 0)
    const revenueHoy = res.filter((r: any) => String(r.checkIn || '').slice(0, 10) === t).reduce((s: number, r: any) => s + (r.totalAmount || 0), 0)
    const revenueServicios = res.reduce((s: number, r: any) => s + (r.deposit || 0), 0)
    const checkinsHoy = res.filter((r: any) => r.checkIn && String(r.checkIn).slice(0, 10) === t && (r.status === 'confirmed' || r.status === 'checked_in')).length
    const checkoutsHoy = res.filter((r: any) => r.checkOut && String(r.checkOut).slice(0, 10) === t && (r.status === 'checked_in' || r.status === 'checked_out')).length
    const noShows = res.filter((r: any) => r.checkIn && String(r.checkIn).slice(0, 10) === t && r.status === 'pending').length
    const cancelaciones = res.filter((r: any) => r.status === 'cancelled').length
    const nightsOf = (r: any) => { const a = new Date(String(r.checkIn).slice(0, 10)).getTime(); const b = new Date(String(r.checkOut).slice(0, 10)).getTime(); return a && b && b > a ? Math.round((b - a) / 86400000) : 0 }
    const totalNightsSold = res.reduce((s: number, r: any) => s + nightsOf(r), 0)
    const adr = totalNightsSold > 0 ? Math.round(revenueTotal / totalNightsSold) : 0
    const revpar = Math.round(adr * (ocupacion / 100))
    const adrYesterday = occupied > 0 ? Math.round(res.filter((r: any) => String(r.checkIn || '').slice(0, 10) === yesterday).reduce((s: number, r: any) => s + (r.totalAmount || 0), 0) / Math.max(occupied, 1)) : 0
    return { fecha: t, ocupacion, habitacionesOcupadas: occupied, habitacionesTotales: rooms.length, ingresosHabitaciones: revenueHoy, ingresosServicios: revenueServicios, impuestos: 0, totalDia: revenueHoy + revenueServicios, checkins: checkinsHoy, checkouts: checkoutsHoy, noShows, cancelaciones, nochesVendidas: res.filter((r: any) => r.status === 'checked_in' || r.status === 'checked_out').length, adr, revpar, adrAyer: adrYesterday, pagosRecibidos: res.reduce((s: number, r: any) => s + (r.deposit || 0), 0), pagosPendientes: res.filter((r: any) => r.status !== 'cancelled').reduce((s: number, r: any) => s + Math.max(0, (r.totalAmount || 0) - (r.deposit || 0)), 0), depositos: res.filter((r: any) => r.status === 'pending').reduce((s: number, r: any) => s + (r.deposit || 0), 0), reembolsos: 0 }
  }

  async markNoShows(): Promise<number> {
    const todayStr = new Date().toISOString().split('T')[0]
    const reservas = (await this.orm.findMany('Reservations', {})) as any[]
    let count = 0
    for (const r of reservas) {
      const ci = String(r.checkIn || '').slice(0, 10)
      if ((r.status === 'pending' || r.status === 'confirmed') && ci && ci < todayStr) {
        await this.orm.update('Reservations', r.id, { status: 'no_show' })
        count++
      }
    }
    return count
  }
}
