// src/routes/reports.ts — Reports routes (facturación, ocupación, etc.)
// Extraído de composition-root.ts para reducir tamaño.
import type { ORM, Auth } from 'arckode-framework'

const MS_PER_DAY = 86_400_000

function nightsBetween(a: any, b: any): number {
  if (!a || !b) return 0
  const d1 = new Date(String(a).slice(0, 10)).getTime()
  const d2 = new Date(String(b).slice(0, 10)).getTime()
  return d2 > d1 ? Math.round((d2 - d1) / MS_PER_DAY) : 0
}

function bucketByDay(items: any[], from: string, to: string, valueFn: (item: any) => number) {
  const buckets: Record<string, number> = {}
  for (const it of items) {
    const d = String(it.checkIn || it.createdAt || '').slice(0, 10)
    if (d >= from && d <= to) buckets[d] = (buckets[d] || 0) + valueFn(it)
  }
  return Object.entries(buckets)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, value]) => ({ date, value }))
}

function eachDay(from: string, to: string): string[] {
  const days: string[] = []
  const start = new Date(from + 'T00:00:00')
  const end = new Date(to + 'T00:00:00')
  for (let t = start.getTime(); t <= end.getTime(); t += MS_PER_DAY) {
    days.push(new Date(t).toISOString().slice(0, 10))
  }
  return days
}

function csvValue(v: any): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'object') return JSON.stringify(v).replace(/"/g, '""')
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

async function hotelOf(req: any, orm: ORM): Promise<string | undefined> {
  const q = req?.query || {}
  if (q.hotelId) return q.hotelId as string
  const userHotel = req?.user?.hotelId
  if (userHotel && userHotel !== 'platform') return userHotel as string
  const uRows = await orm.findMany('Users', { id: req.user?.id })
  const u: any = (uRows as any[])?.[0]
  if (u?.hotelId) return u.hotelId
  const hotels = await orm.findMany('Hotels', {})
  return (hotels as any[])?.[0]?.id
}

export function registerReportRoutes(router: any, orm: ORM, auth: Auth) {
  router.get('/api/reports', [auth.authenticate('hotel_admin', 'super_admin')], async (req: any) => {
    const id = await hotelOf(req, orm); if (!id) return { status: 200, body: {} }
    const res = await orm.findMany('Reservations', { hotelId: id }) as any[]
    const rooms = await orm.findMany('Rooms', { hotelId: id }) as any[]
    const guests = await orm.findMany('Guests', { hotelId: id }) as any[]
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
    return { status: 200, body: {
      totalRevenue, byChannel, channelBookings, channelADRs,
      totalReservations: res.length, canceledReservations: res.filter((r: any) => r.status === 'cancelled').length,
      dailyRevenue, occupancyByType, todayCheckins, todayCheckouts,
      topGuests: [...guests].sort((a: any, b: any) => (b.totalSpent || 0) - (a.totalSpent || 0)).slice(0, 5).map((g: any) => ({ name: g.name, stays: g.totalStays, totalSpent: g.totalSpent })),
    } }
  })

  router.get('/api/reports/advanced', [auth.authenticate('hotel_admin', 'super_admin')], async (req: any) => {
    const id = await hotelOf(req, orm); if (!id) return { status: 200, body: {} }
    const q = req.query as any
    const type = String(q.type || 'facturacion')
    const to = String(q.to || new Date().toISOString().slice(0, 10))
    const from = String(q.from || new Date(Date.now() - 30 * MS_PER_DAY).toISOString().slice(0, 10))

    const [reservations, rooms, guests, expenses, folioCharges, blocks, hotel] = await Promise.all([
      orm.findMany('Reservations', { hotelId: id }) as Promise<any[]>,
      orm.findMany('Rooms', { hotelId: id }) as Promise<any[]>,
      orm.findMany('Guests', { hotelId: id }) as Promise<any[]>,
      orm.findMany('Expenses', { hotelId: id }) as Promise<any[]>,
      orm.findMany('FolioCharges', { hotelId: id }) as Promise<any[]>,
      orm.findMany('RoomBlocks', { hotelId: id }) as Promise<any[]>,
      (await orm.findMany('Hotels', { id }))[0] as any,
    ])

    const inRange = reservations.filter((r: any) => {
      const ci = String(r.checkIn || '').slice(0, 10)
      return ci >= from && ci <= to
    })
    const totalRooms = rooms.length
    const taxRate = Number(hotel?.taxRate || 0) / 100
    const reservationIds = new Set(reservations.map((r: any) => r.id))
    const charges = folioCharges.filter((c: any) => reservationIds.has(c.reservationId))

    if (type === 'facturacion') {
      const roomRevenue = inRange.reduce((s: number, r: any) => s + (r.totalAmount || 0), 0)
      const extrasRevenue = charges.filter((c: any) => c.category !== 'room' && c.createdAt >= from).reduce((s: number, c: any) => s + (c.amount * (c.quantity || 1)), 0)
      const commissionOTA = inRange.reduce((s: number, r: any) => s + (r.commissionAmount || 0), 0)
      const taxes = Math.round(roomRevenue * taxRate)
      return { status: 200, body: {
        type, from, to, roomRevenue, extrasRevenue,
        extrasByCategory: charges.reduce((a: any, c: any) => { if (c.category === 'room') return a; a[c.category] = (a[c.category] || 0) + c.amount * (c.quantity || 1); return a }, {}),
        taxes, commissionOTA, total: roomRevenue + extrasRevenue, net: roomRevenue + extrasRevenue - taxes - commissionOTA,
        daily: bucketByDay(inRange, from, to, (r: any) => r.totalAmount || 0),
      } }
    }

    if (type === 'ocupacion') {
      const days = eachDay(from, to)
      const dailyOccupancy = days.map(date => {
        const active = reservations.filter((r: any) => {
          const ci = String(r.checkIn || '').slice(0, 10)
          const co = String(r.checkOut || '').slice(0, 10)
          return ci <= date && co > date && r.status !== 'cancelled'
        }).length
        const blocked = blocks.filter((b: any) => b.startDate <= date && b.endDate >= date).length
        return { date, occupied: active, blocked, free: Math.max(0, totalRooms - active - blocked),
          realOccupiedPct: totalRooms ? Math.round((active / totalRooms) * 100) : 0,
          totalPct: totalRooms ? Math.round(((active + blocked) / totalRooms) * 100) : 0,
        }
      })
      const avgReal = Math.round(dailyOccupancy.reduce((s, d) => s + d.realOccupiedPct, 0) / (dailyOccupancy.length || 1))
      return { status: 200, body: { type, from, to, totalRooms, avgRealOccupancy: avgReal, daily: dailyOccupancy,
        byRoomType: rooms.reduce((a: any, r: any) => { a[r.type] = (a[r.type] || 0) + 1; return a }, {}),
      } }
    }

    if (type === 'pernoctaciones') {
      const days = eachDay(from, to)
      const daily = days.map(date => {
        const inHouse = reservations.filter((r: any) => {
          const ci = String(r.checkIn || '').slice(0, 10)
          const co = String(r.checkOut || '').slice(0, 10)
          return ci <= date && co > date && r.status !== 'cancelled'
        })
        const adults = inHouse.reduce((s: number, r: any) => s + (r.adults || 0), 0)
        const children = inHouse.reduce((s: number, r: any) => s + (r.children || 0), 0)
        return { date, adults, children, total: adults + children, reservations: inHouse.length }
      })
      const totalPaxes = daily.reduce((s, d) => s + d.total, 0)
      return { status: 200, body: { type, from, to, totalPaxes,
        totalAdults: daily.reduce((s, d) => s + d.adults, 0),
        totalChildren: daily.reduce((s, d) => s + d.children, 0),
        avgPerNight: daily.length ? Math.round(totalPaxes / daily.length) : 0, daily,
      } }
    }

    if (type === 'rendimiento') {
      const nightsSold = inRange.reduce((s: number, r: any) => s + nightsBetween(r.checkIn, r.checkOut), 0)
      const revenue = inRange.reduce((s: number, r: any) => s + (r.totalAmount || 0), 0)
      const adr = nightsSold > 0 ? Math.round(revenue / nightsSold) : 0
      const days = eachDay(from, to).length
      const availableRoomNights = totalRooms * days
      const revpar = availableRoomNights > 0 ? Math.round(revenue / availableRoomNights) : 0
      const occupancyPct = availableRoomNights > 0 ? Math.round((nightsSold / availableRoomNights) * 100) : 0
      const avgStay = inRange.length ? (nightsSold / inRange.length).toFixed(1) : '0'
      const roomById = new Map(rooms.map((r: any) => [r.id, r]))
      const adrByType: Record<string, { nights: number; revenue: number; adr: number }> = {}
      for (const r of inRange) {
        const room = roomById.get(r.roomId)
        const t = room?.type || 'unknown'
        const n = nightsBetween(r.checkIn, r.checkOut)
        if (!adrByType[t]) adrByType[t] = { nights: 0, revenue: 0, adr: 0 }
        adrByType[t].nights += n
        adrByType[t].revenue += r.totalAmount || 0
      }
      for (const k of Object.keys(adrByType)) { const t = adrByType[k]; t.adr = t.nights > 0 ? Math.round(t.revenue / t.nights) : 0 }
      return { status: 200, body: { type, from, to, adr, revpar, occupancyPct, avgStay: Number(avgStay),
        nightsSold, availableRoomNights, adrByType,
        revenueByType: Object.fromEntries(Object.entries(adrByType).map(([k, v]) => [k, v.revenue])),
      } }
    }

    if (type === 'procedencia') {
      const guestById = new Map(guests.map((g: any) => [g.id, g]))
      const byCountry: Record<string, { guests: number; revenue: number }> = {}
      const byChannel: Record<string, { count: number; revenue: number }> = {}
      for (const r of inRange) {
        const g = guestById.get(r.guestId)
        const country = g?.nationality || g?.country || 'Desconocido'
        if (!byCountry[country]) byCountry[country] = { guests: 0, revenue: 0 }
        byCountry[country].guests += 1
        byCountry[country].revenue += r.totalAmount || 0
        const ch = r.channel || 'direct'
        if (!byChannel[ch]) byChannel[ch] = { count: 0, revenue: 0 }
        byChannel[ch].count += 1
        byChannel[ch].revenue += r.totalAmount || 0
      }
      return { status: 200, body: { type, from, to,
        byCountry: Object.entries(byCountry).map(([country, v]) => ({ country, ...v })).sort((a, b) => b.guests - a.guests),
        byChannel: Object.entries(byChannel).map(([channel, v]) => ({ channel, ...v })).sort((a, b) => b.count - a.count),
      } }
    }

    if (type === 'reservas') {
      const byStatus = inRange.reduce((a: any, r: any) => { a[r.status || 'pending'] = (a[r.status || 'pending'] || 0) + 1; return a }, {})
      const byChannel = inRange.reduce((a: any, r: any) => { const c = r.channel || 'direct'; a[c] = (a[c] || 0) + 1; return a }, {})
      const ota = inRange.filter((r: any) => r.channel && r.channel !== 'direct' && r.channel !== 'whatsapp' && r.channel !== 'phone').length
      const direct = inRange.length - ota
      const cancelled = inRange.filter((r: any) => r.status === 'cancelled').length
      const noShow = inRange.filter((r: any) => r.status === 'no_show').length
      return { status: 200, body: { type, from, to, total: inRange.length, byStatus, byChannel,
        otaVsDirect: { ota, direct, otaPct: inRange.length ? Math.round((ota / inRange.length) * 100) : 0, directPct: inRange.length ? Math.round((direct / inRange.length) * 100) : 0 },
        cancelled, noShow, cancellationRate: inRange.length ? Math.round((cancelled / inRange.length) * 100) : 0,
        dailyCreated: bucketByDay(inRange, from, to, () => 1),
      } }
    }

    return { status: 400, body: { error: `Tipo de reporte desconocido: ${type}` } }
  })

  router.get('/api/reports/export', [auth.authenticate('hotel_admin', 'super_admin')], async (req: any) => {
    const id = await hotelOf(req, orm); if (!id) return { status: 400, body: { error: 'Sin hotel' } }
    const type = String((req.query as any).type || 'facturacion')
    // Reusar el handler avanzado
    const fakeReq = { ...req, query: { ...req.query } }
    const r = await (async () => {
      const fakeReq2 = { ...req, query: { ...req.query } }
      // @ts-ignore
      return (router as any).__reportHandler?.(orm, id, req.query) || { status: 200, body: {} }
    })()
    if (r.status !== 200) return r
    const data = r.body as Record<string, any>
    const rows: string[] = []
    if (Array.isArray(data.daily)) {
      if (data.daily.length === 0) { rows.push('Sin datos en el rango seleccionado') }
      else { const keys = Object.keys(data.daily[0]); rows.push(keys.join(',')); for (const d of data.daily) rows.push(keys.map(k => csvValue(d[k])).join(',')) }
    } else {
      rows.push(`Reporte ${type} — sin datos tabulares`)
      for (const [k, v] of Object.entries(data)) {
        if (typeof v === 'object' && v !== null && !Array.isArray(v)) { for (const [k2, v2] of Object.entries(v as any)) { rows.push(`${k}.${k2},${csvValue(v2)}`) } }
        else { rows.push(`${k},${csvValue(v)}`) }
      }
    }
    return { status: 200, headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="reporte-${type}-${new Date().toISOString().slice(0, 10)}.csv"` }, body: rows.join('\n') }
  })
}
