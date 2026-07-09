import { MS_PER_DAY } from '../helpers'
import type { ReportContext } from '../strategies/types'
import { reportStrategies } from '../strategies'
import {
  inDateRange, paymentDate, expenseDate, sumCharged, sumRefunded, chargeTotal, isConsumption,
} from './money'

export class ReportQueries {
  constructor(private readonly orm: any) {}

  async resolveHotelId(req: any): Promise<string | undefined> {
    const q = req?.query || {}
    if (q.hotelId) {
      const userHotel = req?.user?.hotelId
      if (userHotel && userHotel !== 'platform') {
        if (q.hotelId !== userHotel) throw new Error('Access denied: can only view own hotel data')
      }
      return q.hotelId as string
    }
    const userHotel = req?.user?.hotelId
    if (userHotel && userHotel !== 'platform') return userHotel as string
    const uRows = await this.orm.findMany('Users', { id: req.user?.id })
    const u: any = (uRows as any[])?.[0]
    if (u?.hotelId) return u.hotelId
    const isAdmin = req?.user?.userType === 'admin' || req?.user?.role === 'super_admin'
    if (isAdmin) {
      const hotels = await this.orm.findMany('Hotels', {})
      return (hotels as any[])?.[0]?.id
    }
    throw new Error('No hotel assigned to user')
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
    const [reservations, rooms, guests, expenses, payments, folioCharges, blocks, hotel] = await Promise.all([
      this.orm.findMany('Reservations', { hotelId }) as Promise<any[]>,
      this.orm.findMany('Rooms', { hotelId }) as Promise<any[]>,
      this.orm.findMany('Guests', { hotelId }) as Promise<any[]>,
      this.orm.findMany('Expenses', { hotelId }) as Promise<any[]>,
      // El modelo se registra en singular (`orm.define('Payment', ...)`), no 'Payments'.
      this.orm.findMany('Payment', { hotelId }) as Promise<any[]>,
      this.orm.findMany('FolioCharges', { hotelId }) as Promise<any[]>,
      this.orm.findMany('RoomBlocks', { hotelId }) as Promise<any[]>,
      (await this.orm.findMany('Hotels', { id: hotelId }))[0] as any,
    ])
    const inRange = reservations.filter((r: any) => { const ci = String(r.checkIn || '').slice(0, 10); return ci >= from && ci <= to })
    const totalRooms = rooms.length
    const taxRate = Number(hotel?.taxRate || 0) / 100

    // Gastos y pagos se acotan al período: un reporte de un mes no puede sumar la tabla entera.
    const expensesInRange = inDateRange(expenses, from, to, expenseDate)
    const paymentsInRange = inDateRange(payments, from, to, paymentDate)

    const ctx: ReportContext = {
      from, to, totalRooms, taxRate, reservations: inRange, rooms, guests,
      expenses: expensesInRange, payments: paymentsInRange, folioCharges, blocks, hotel,
    }
    const strategy = reportStrategies.find(s => s.type === type)
    if (!strategy) throw new Error(`Tipo de reporte desconocido: ${type}`)
    return strategy.execute(ctx)
  }

  /**
   * Cierre del día. Los ingresos salen del libro auxiliar (`folio_charges`) y del asiento del dinero
   * (`payments`), NO de `Reservations`: antes se sumaba la tabla entera y se etiquetaba "del día",
   * así que ADR, RevPAR y "pagos recibidos" arrastraban toda la historia del hotel.
   *
   * Si el hotel todavía no opera con folios, los ingresos del día son 0. Es el número correcto:
   * no se posteó nada.
   */
  async getNightAudit(hotelId: string): Promise<any> {
    const [rooms, res, payments, folioCharges] = await Promise.all([
      this.orm.findMany('Rooms', { hotelId }) as Promise<any[]>,
      this.orm.findMany('Reservations', { hotelId }) as Promise<any[]>,
      this.orm.findMany('Payment', { hotelId }) as Promise<any[]>,
      this.orm.findMany('FolioCharges', { hotelId }) as Promise<any[]>,
    ])
    const t = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - MS_PER_DAY).toISOString().split('T')[0]

    const chargeDay = (c: any) => String(c.postedAt || c.createdAt || '').slice(0, 10)
    const consumptionOn = (d: string) => folioCharges.filter((c: any) => chargeDay(c) === d && isConsumption(c))
    const roomChargesOn = (d: string) => consumptionOn(d).filter((c: any) => c.category === 'room')
    const roomRevenueOn = (d: string) => roomChargesOn(d).reduce((s: number, c: any) => s + chargeTotal(c), 0)

    const todayConsumption = consumptionOn(t)
    const ingresosHabitaciones = roomRevenueOn(t)
    const ingresosServicios = todayConsumption.filter((c: any) => c.category !== 'room').reduce((s: number, c: any) => s + chargeTotal(c), 0)
    const impuestos = todayConsumption.reduce((s: number, c: any) => s + Number(c.taxes || 0), 0)

    const paymentsToday = inDateRange(payments, t, t, paymentDate)
    const pagosRecibidos = sumCharged(paymentsToday)
    const reembolsos = sumRefunded(paymentsToday)

    const occupied = rooms.filter((r: any) => r.status === 'occupied').length
    const ocupacion = rooms.length ? Math.round((occupied / rooms.length) * 100) : 0

    // Una noche vendida = un cargo de habitación posteado ese día (uno por folio in-house).
    const nochesVendidas = roomChargesOn(t).length
    const nochesVendidasAyer = roomChargesOn(yesterday).length
    const adr = nochesVendidas > 0 ? Math.round(ingresosHabitaciones / nochesVendidas) : 0
    const adrAyer = nochesVendidasAyer > 0 ? Math.round(roomRevenueOn(yesterday) / nochesVendidasAyer) : 0
    const revpar = rooms.length > 0 ? Math.round(ingresosHabitaciones / rooms.length) : 0

    const dayOf = (v: any) => String(v || '').slice(0, 10)
    const checkins = res.filter((r: any) => dayOf(r.checkIn) === t && (r.status === 'confirmed' || r.status === 'checked_in')).length
    const checkouts = res.filter((r: any) => dayOf(r.checkOut) === t && (r.status === 'checked_in' || r.status === 'checked_out')).length
    const noShows = res.filter((r: any) => dayOf(r.checkIn) === t && r.status === 'pending').length
    const cancelaciones = res.filter((r: any) => r.status === 'cancelled' && dayOf(r.updatedAt) === t).length

    // Saldos, no movimientos del día: la deuda viva y las garantías retenidas.
    const activas = res.filter((r: any) => r.status !== 'cancelled')
    const pagosPendientes = activas.reduce((s: number, r: any) => s + Math.max(0, (r.totalAmount || 0) - (r.deposit || 0)), 0)
    const depositos = res.filter((r: any) => r.status === 'pending').reduce((s: number, r: any) => s + (r.deposit || 0), 0)

    return {
      fecha: t, ocupacion, habitacionesOcupadas: occupied, habitacionesTotales: rooms.length,
      ingresosHabitaciones, ingresosServicios, impuestos,
      totalDia: ingresosHabitaciones + ingresosServicios,
      checkins, checkouts, noShows, cancelaciones, nochesVendidas,
      adr, revpar, adrAyer,
      pagosRecibidos, pagosPendientes, depositos, reembolsos,
    }
  }

  async markNoShows(hotelId?: string): Promise<number> {
    const todayStr = new Date().toISOString().split('T')[0]
    const filters: any = {}
    if (hotelId) filters.hotelId = hotelId
    const reservas = (await this.orm.findMany('Reservations', filters)) as any[]
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
