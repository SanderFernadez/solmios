function safeParse(v: any) { if (typeof v !== 'string') return v; try { return JSON.parse(v) } catch { return v } }

export class CanalesQueries {
  constructor(private readonly orm: any) {}

  async findMany(model: string, query: any): Promise<any[]> {
    return this.orm.findMany(model, query)
  }

  async resolveHotelId(hotelId?: string): Promise<string | undefined> {
    if (hotelId) return hotelId
    return ((await this.orm.findMany('Hotels', {}))[0] as any)?.id
  }

  async getSyncLog(hotelId?: string): Promise<any[]> {
    const rows = await this.orm.findMany('Configuration', { hotelId: hotelId || 'platform', key: 'channex_sync_log' })
    const raw = (rows[0] as any)?.value; return raw ? JSON.parse(raw) : []
  }

  async getOTACatalog(): Promise<any[]> {
    try {
      // `key` (no `clave`): el modelo Configuration usa `key`; con `clave` el ORM descartaba el filtro
      // (campo inexistente) y traía la 1ª config del platform → catálogo siempre vacío. Fix.
      const rows = await this.orm.findMany('Configuration', { hotelId: 'platform', key: 'canales_ota' })
      const cfg = (rows as any[])?.[0]
      if (!cfg) return []
      const val = typeof cfg.value === 'string' ? JSON.parse(cfg.value) : cfg.value
      return Array.isArray(val) ? val : []
    } catch { return [] }
  }

  // ─── Credenciales Channex a nivel PLATAFORMA (white-label: una cuenta para todos los hoteles) ──
  // Se guardan en configuration(hotelId='platform', key='channex') = { apiKey, environment }.
  async getPlatformChannex(): Promise<{ apiKey?: string; environment?: string } | null> {
    try {
      const rows = await this.orm.findMany('Configuration', { hotelId: 'platform', key: 'channex' })
      const row = (rows as any[])?.[0]
      if (!row) return null
      const v = typeof row.value === 'string' ? JSON.parse(row.value) : row.value
      return v && typeof v === 'object' && !Array.isArray(v) ? v : null
    } catch { return null }
  }

  async setPlatformChannex(patch: { apiKey?: string; environment?: string }): Promise<void> {
    const rows = await this.orm.findMany('Configuration', { hotelId: 'platform', key: 'channex' })
    const row = (rows as any[])?.[0]
    const cur = row ? (typeof row.value === 'string' ? JSON.parse(row.value) : row.value) : {}
    const value = { ...(cur && typeof cur === 'object' ? cur : {}), ...patch }
    if (row) await this.orm.update('Configuration', row.id, { value })
    else await this.orm.create('Configuration', { id: crypto.randomUUID(), hotelId: 'platform', key: 'channex', value })
  }

  async applyBookingRevision(dto: any, hotelId: string, channex: any, apiKey: string): Promise<void> {
    if (dto.externalLocator) {
      const existing = await this.orm.findMany('Reservations', { hotelId, externalLocator: dto.externalLocator })
      if (existing && existing.length > 0) {
        if (dto.status === 'cancelled') {
          await this.orm.update('Reservations', existing[0].id, { status: 'cancelled' })
        }
        return
      }
    }

    const { channexRoomTypeId, channexRevisionId, channexBookingId, ...payload } = dto
    let roomId: string | null = null
    if (channexRoomTypeId) {
      const rt = await channex.getRoomTypeById(apiKey, channexRoomTypeId)
      if (rt?.title) {
        const rooms = await this.orm.findMany('Rooms', { hotelId, type: rt.title })
        roomId = rooms?.[0]?.id || null
      }
    }
    if (!roomId) {
      const any = await this.orm.findMany('Rooms', { hotelId })
      roomId = any?.[0]?.id || null
      if (roomId && payload.notes) payload.notes = `${payload.notes} | ⚠ AUTO-ASSIGNED ROOM (no type match)`
    }
    if (!roomId) throw new Error(`Sin habitaciones para el hotel ${hotelId}`)

    payload.id = crypto.randomUUID()
    payload.roomId = roomId
    await this.orm.create('Reservations', payload)
  }
}
