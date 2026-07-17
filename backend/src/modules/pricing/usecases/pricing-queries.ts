export class PricingQueries {
  constructor(private readonly orm: any) {}

  /** Tipos de habitación distintos del hotel, con ocupación (capacity) y precio base de referencia. */
  async roomTypesFor(hotelId: string): Promise<{ type: string; occupancy: number; basePrice: number }[]> {
    const rooms = await this.orm.findMany('Rooms', { hotelId }) as any[]
    const byType = new Map<string, { type: string; occupancy: number; basePrice: number }>()
    for (const r of rooms) {
      const type = r.type || 'standard'
      if (!byType.has(type)) byType.set(type, { type, occupancy: Number(r.capacity) || 2, basePrice: Number(r.basePrice) || 0 })
    }
    return [...byType.values()]
  }

  /**
   * Grilla de tarifas para un canal: una fila por (roomType × occupancy × season). La base sale de las
   * tarifas base (channel='') si existen; si no, se deriva de los tipos de habitación + temporadas para
   * que el editor nunca aparezca vacío (estilo MisterPlan). Aplica el override del canal donde exista;
   * las demás filas van marcadas `_inherited` (aún sin override propio, precio = base).
   */
  async listChannelRates(hotelId: string, channel: string, allRates?: any[]): Promise<any[]> {
    const all = allRates ?? (await this.orm.findMany('RoomRates', { hotelId }) as any[])
    const base = all.filter((r) => !r.channel)
    const key = (rt: string, occ: number, s: string) => `${rt}|${occ}|${s}`
    const overrides = new Map(all.filter((r) => r.channel === channel).map((o) => [key(o.roomType, o.occupancy, o.season), o]))
    const baseByKey = new Map(base.map((b) => [key(b.roomType, b.occupancy, b.season), b]))

    // Celdas base: las tarifas base existentes, o derivadas de room types × temporadas si no hay ninguna.
    let cells: { roomType: string; occupancy: number; season: string; basePrice: number }[]
    if (base.length) {
      cells = base.map((b) => ({ roomType: b.roomType, occupancy: b.occupancy, season: b.season, basePrice: b.basePrice ?? 0 }))
    } else {
      const seasons = await this.orm.findMany('Seasons', { hotelId }) as any[]
      const seasonNames = seasons.length ? seasons.map((s: any) => s.name) : ['baja', 'media', 'alta', 'especial']
      const roomTypes = await this.roomTypesFor(hotelId)
      cells = []
      for (const rt of roomTypes) for (const season of seasonNames) cells.push({ roomType: rt.type, occupancy: rt.occupancy, season, basePrice: rt.basePrice })
    }

    return cells.map((c) => {
      const ov = overrides.get(key(c.roomType, c.occupancy, c.season))
      if (ov) return ov
      const b = baseByKey.get(key(c.roomType, c.occupancy, c.season))
      const basePrice = (b?.basePrice ?? c.basePrice) || 0
      return { hotelId, roomType: c.roomType, occupancy: c.occupancy, season: c.season, channel, basePrice, percentage: 0, price: basePrice, closed: 0, minStay: 0, maxStay: 0, _inherited: true }
    })
  }

  async getChannelMetrics(hotelId: string): Promise<any[]> {
    const reservations = await this.orm.findMany('Reservations', { hotelId }) as any[]
    const rooms = await this.orm.findMany('Rooms', { hotelId }) as any[]
    const byChannel: Record<string, { count: number; revenue: number; nights: number }> = {}
    for (const r of reservations) {
      const ch = r.channel || 'direct'
      if (!byChannel[ch]) byChannel[ch] = { count: 0, revenue: 0, nights: 0 }
      byChannel[ch].count++; byChannel[ch].revenue += r.totalAmount || 0
      const ci = new Date(String(r.checkIn).slice(0, 10)).getTime()
      const co = new Date(String(r.checkOut).slice(0, 10)).getTime()
      byChannel[ch].nights += co > ci ? Math.round((co - ci) / 86400000) : 0
    }
    return Object.entries(byChannel).map(([channel, data]) => ({
      channel, bookings: data.count, revenue: data.revenue,
      adr: data.nights > 0 ? Math.round(data.revenue / data.nights) : 0,
      revpar: rooms.length > 0 ? Math.round(data.revenue / rooms.length) : 0,
      avgStay: data.count > 0 ? (data.nights / data.count).toFixed(1) : '0',
    }))
  }
}
