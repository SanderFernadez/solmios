// canales/usecases/channex.ts — Cliente y operaciones de Channex
// Responsabilidad ÚNICA: hablar con la API de Channex (channel manager).
// NO toca la base de datos — recibe la config y devuelve resultados.
// El service decide qué persistir. Así el service se mantiene < 200 líneas.

import type { Logger } from 'arckode-framework'
import type { CanalesDTO, ChannelDTO, ChannelsResultDTO, RoomTypeSummary, SyncResultDTO, TestConnectionDTO, TestConnectionResultDTO, MappingDetailDTO, OTAChannelCreateDTO, OTAChannelResultDTO, GroupDTO, OTAChannelMeta, BookingRevisionDTO, BookingIngestionResult } from '../types'

const CHANNEX_BASE = process.env.CHANNEX_BASE_URL || 'https://staging.channex.io/api/v1'
const CHANNEX_KEY = process.env.CHANNEX_API_KEY || ''

export class ChannexUseCase {
  constructor(private readonly logger: Logger) {}

  private resolveKey(cfg?: CanalesDTO | null): string {
    return cfg?.channexApiKey || CHANNEX_KEY
  }

  private async channexReq(apiKey: string, method: string, path: string, body?: any) {
    if (!apiKey) throw new Error('Channex API key no configurada')
    const url = `${CHANNEX_BASE}${path}`
    const opts: any = { method, headers: { 'Content-Type': 'application/json', 'user-api-key': apiKey } }
    if (body && method !== 'GET') opts.body = JSON.stringify(body)
    const r = await fetch(url, opts)
    const t = await r.text()
    try { return { ok: r.ok, data: JSON.parse(t) } } catch { return { ok: r.ok, data: t } }
  }

  // ─── Canales conectados (Channex real + catálogo de la DB) ──────────
  async listChannels(cfg: CanalesDTO | undefined, catalog: OTAChannelMeta[]): Promise<ChannelsResultDTO> {
    const channels: ChannelDTO[] = []
    let connectedCount = 0
    const key = this.resolveKey(cfg)

    const matchCatalog = (otaCode: string, name: string): OTAChannelMeta | undefined => {
      const code = otaCode.toLowerCase()
      const n = name.toLowerCase()
      return catalog.find(item => {
        if (item.channexCode.toLowerCase() === code) return true
        return (item.aliases || []).some(a => a.toLowerCase() === code) || item.name.toLowerCase() === n
      })
    }

    if (cfg?.channexPropertyId) {
      try {
        const res = await this.channexReq(key, 'GET', `/channels?filter[property_id]=${cfg.channexPropertyId}`)
        const raw = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : [])
        for (const ch of raw) {
          const a = ch.attributes || ch
          const otaCode = a.channel || ''
          const name = a.title || a.name || otaCode || 'OTA'
          const meta = matchCatalog(otaCode, name)
          channels.push({
            id: ch.id, nombre: meta?.name || name, tipo: meta?.type || 'ota',
            conectado: true, bookings: a.bookings_count || 0, ultimaSync: a.updated_at || cfg.lastSync || null,
            otaCode: meta?.channexCode || otaCode, activo: a.is_active || false,
            icono: meta?.icon, color: meta?.color, descripcion: meta?.description,
          })
        }
        connectedCount = channels.filter(c => c.conectado).length
      } catch (e) { this.logger.warn('Channex channels falló, usando catálogo', { error: String(e) }) }
    }

    for (const item of catalog) {
      const alreadyExists = channels.some(c =>
        (c.otaCode || '').toLowerCase() === item.channexCode.toLowerCase() ||
        (item.aliases || []).some(a => a.toLowerCase() === (c.id || c.name || '').toLowerCase())
      )
      if (!alreadyExists) {
        channels.push({
          nombre: item.name, tipo: item.type, otaCode: item.channexCode, conectado: false,
          icono: item.icon, color: item.color, descripcion: item.description,
        })
      }
    }

    let pendingBookings = 0
    try {
      const feed = await this.channexReq(key, 'GET', '/booking_revisions/feed?limit=10')
      pendingBookings = feed.data?.meta?.total || 0
    } catch { /* feed opcional */ }

    return { data: channels, connectedCount, pendingBookings, syncEnabled: (cfg?.syncEnabled ?? 1) === 1, ultimaSync: cfg?.lastSync || null, channexPropertyId: cfg?.channexPropertyId || null }
  }

  async getFeed(): Promise<{ pendingBookings: number }> {
    try {
      const feed = await this.channexReq(CHANNEX_KEY, 'GET', '/booking_revisions/feed?limit=10')
      return { pendingBookings: feed.data?.meta?.total || 0 }
    } catch { return { pendingBookings: 0 } }
  }

  // ─── Sincronización: crea propiedad + room types + rate plans + ARI ──
  // Si ya existe channexPropertyId → limpia datos viejos y resincroniza.
  async syncProperty(hotel: { nombre: string; moneda?: string; email?: string; direccion?: string; zonaHoraria?: string }, rooms: RoomTypeSummary[], cfg: CanalesDTO | undefined): Promise<{ result: SyncResultDTO; newPropertyId: string | null }> {
    const key = this.resolveKey(cfg)

    let channexPId = cfg?.channexPropertyId

    if (!channexPId) {
      const propRes = await this.channexReq(key, 'POST', '/properties', {
        property: { title: hotel.name, currency: hotel.currency || 'USD', email: hotel.email, address: hotel.address, timezone: hotel.timezone || 'America/Santo_Domingo' },
      })
      if (!propRes.ok || !propRes.data?.data) throw new Error('No se pudo crear la propiedad en Channex')
      channexPId = propRes.data.data.id
    } else {
      try {
        const oldRPs = await this.channexReq(key, 'GET', `/rate_plans?filter[property_id]=${channexPId}`)
        for (const rp of (oldRPs.data?.data || [])) {
          await this.channexReq(key, 'DELETE', `/rate_plans/${rp.id}`).catch(() => {})
        }
      } catch {}
      try {
        const oldRTs = await this.channexReq(key, 'GET', `/room_types?filter[property_id]=${channexPId}`)
        for (const rt of (oldRTs.data?.data || [])) {
          await this.channexReq(key, 'DELETE', `/room_types/${rt.id}`).catch(() => {})
        }
      } catch {}
    }

    const createdRTs: any[] = []
    const rtResults = await Promise.all(rooms.map(rt =>
      this.channexReq(key, 'POST', '/room_types', { room_type: { property_id: channexPId, title: rt.type, count_of_rooms: rt.cnt, occ_adults: rt.capacity, occ_children: 1, occ_infants: 1 } })
    ))
    rtResults.filter(r => r.ok && r.data?.data).forEach(r => createdRTs.push(r.data.data))

    const today = new Date().toISOString().split('T')[0]
    const future = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
    const rtList = (await this.channexReq(key, 'GET', `/room_types?filter[property_id]=${channexPId}`)).data?.data || []
    const rpList = (await this.channexReq(key, 'GET', `/rate_plans?filter[property_id]=${channexPId}`)).data?.data || []

    // Batch rate plan creation
    const rpCreated = await Promise.all(createdRTs.map(rt => {
      const title = rt.attributes?.title || rt.title
      const roomData = rooms.find(rm => rm.type === title)
      const price = Math.round((roomData?.basePrice || 100) * 100)
      const occ = roomData?.capacity || 2
      return this.channexReq(key, 'POST', '/rate_plans', { rate_plan: { property_id: channexPId, room_type_id: rt.id, title: `${title} Standard`, currency: hotel.currency || 'USD', sell_mode: 'per_room', rate_mode: 'manual', options: [{ occupancy: occ, is_primary: true, rate: price }] } })
    }))

    // Batch availability push
    await Promise.all(rtList.map(rt => {
      const rData = rooms.find(rm => rm.type === (rt.attributes?.title || rt.title))
      return this.channexReq(key, 'POST', '/availability', { values: [{ property_id: channexPId, room_type_id: rt.id, date_from: today, date_to: future, availability: rData?.cnt || rt.attributes?.count_of_rooms || 1 }] })
    }))

    // Batch restrictions push
    await Promise.all(rpList.map(rp => {
      const rt = rtList.find((r: any) => r.id === rp.attributes?.room_type_id)
      const rData = rooms.find(rm => rm.type === (rt?.attributes?.title || rt?.title))
      return this.channexReq(key, 'POST', '/restrictions', { values: [{ property_id: channexPId, rate_plan_id: rp.id, date_from: today, date_to: future, rate: Math.round(rData?.basePrice || 100) }] })
    }))

    this.logger.info('Sync Channex OK', { channexPropertyId: channexPId, roomTypes: rtList.length, ratePlans: rpList.length })
    return { result: { success: true, message: `Sincronización completa: ${rtList.length} room types, ${rpList.length} rate plans`, channexPropertyId: channexPId, roomTypes: rtList.length, ratePlans: rpList.length }, newPropertyId: channexPId }
  }

  // ─── Push de tarifa (cuando cambia precioBase de una habitación) ─────
  async pushRate(cfg: CanalesDTO | undefined, roomType: string, precioBase: number): Promise<{ pushed: boolean }> {
    if (!cfg?.channexPropertyId) return { pushed: false }
    const key = this.resolveKey(cfg)
    const rts = await this.channexReq(key, 'GET', `/room_types?filter[property_id]=${cfg.channexPropertyId}`)
    const rtList: any[] = rts.data?.data || []
    const targetRt = rtList.find(rt => String(rt.attributes?.title || '').toLowerCase() === roomType.toLowerCase())
    const rps = await this.channexReq(key, 'GET', `/rate_plans?filter[property_id]=${cfg.channexPropertyId}`)
    const rpList: any[] = rps.data?.data || []
    const targetRp = rpList.find(rp => rp.attributes?.room_type_id === targetRt?.id)
    if (!targetRp) return { pushed: false }
    const today = new Date().toISOString().split('T')[0]
    const future = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
    await this.channexReq(key, 'POST', '/restrictions', { values: [{ property_id: cfg.channexPropertyId, rate_plan_id: targetRp.id, date_from: today, date_to: future, rate: Math.round(precioBase * 100) }] })
    this.logger.info('Tarifa Channex actualizada', { roomType, precioBase })
    return { pushed: true }
  }

  // ─── Channel API (conexión OTA) ──────────────────────────────────────
  async testConnection(cfg: CanalesDTO | undefined, dto: TestConnectionDTO): Promise<TestConnectionResultDTO> {
    const key = this.resolveKey(cfg)
    const res = await this.channexReq(key, 'POST', '/channels/test_connection', {
      channel: dto.channel,
      settings: { hotel_id: dto.hotel_id },
    })
    if (!res.ok) {
      const err = res.data?.errors
      return { success: false, message: err?.title || err?.details?.join(', ') || 'Error de conexión con la OTA', details: res.data }
    }
    return { success: true, message: 'Conexión exitosa', details: res.data }
  }

  async getMappingDetails(cfg: CanalesDTO | undefined, channel: string, hotelId: string): Promise<{ success: boolean; rooms: MappingDetailDTO[]; error?: string }> {
    const key = this.resolveKey(cfg)
    const res = await this.channexReq(key, 'POST', '/channels/mapping_details', {
      channel,
      settings: { hotel_id: hotelId },
    })
    if (!res.ok) return { success: false, rooms: [], error: res.data?.errors?.title || 'Error al obtener mapping details' }
    const data = res.data?.data || res.data || {}
    return { success: true, rooms: Array.isArray(data.rooms) ? data.rooms : [] }
  }

  async listGroups(cfg: CanalesDTO | undefined): Promise<GroupDTO[]> {
    const key = this.resolveKey(cfg)
    const res = await this.channexReq(key, 'GET', '/groups')
    if (!res.ok) return []
    const data = res.data?.data || res.data || []
    return Array.isArray(data) ? data.map((g: any) => ({ id: g.id, name: g.attributes?.name || g.name || g.id })) : []
  }

  async createOTAChannel(cfg: CanalesDTO | undefined, dto: OTAChannelCreateDTO): Promise<OTAChannelResultDTO> {
    const key = this.resolveKey(cfg)
    const steps = { test: false, mapping: false, create: false, activate: false }

    let ratePlansData = dto.ratePlans
    if (ratePlansData.length === 0 && dto.propertyId) {
      const rps = await this.channexReq(key, 'GET', `/rate_plans?filter[property_id]=${dto.propertyId}`)
      const rpList: any[] = rps.data?.data || []
      ratePlansData = rpList.map((rp: any, i: number) => {
        const a = rp.attributes || rp
        const opts = a.options || []
        return {
          ratePlanId: rp.id || a.id,
          roomTypeCode: i + 1,
          ratePlanCode: i + 1,
          occupancy: opts[0]?.occupancy || 2,
          pricingType: 'per_room',
          primaryOcc: true,
        }
      })
      steps.mapping = ratePlansData.length > 0
    }

    const createRes = await this.channexReq(key, 'POST', '/channels', {
      channel: {
        channel: dto.channel,
        group_id: dto.groupId,
        is_active: true,
        title: dto.title,
        properties: [dto.propertyId],
        rate_plans: ratePlansData.map(rp => ({
          rate_plan_id: rp.ratePlanId,
          settings: {
            room_type_code: Number(rp.roomTypeCode),
            rate_plan_code: Number(rp.ratePlanCode),
            occupancy: rp.occupancy,
            pricing_type: rp.pricingType,
            primary_occ: rp.primaryOcc ?? true,
          },
        })),
        settings: dto.settings || {},
      },
    })

    if (!createRes.ok) {
      const err = createRes.data?.errors
      return { success: false, message: err?.title || err?.details?.join(', ') || 'Error al crear canal OTA', steps }
    }
    steps.create = true
    const channelId = createRes.data?.data?.id

    const actRes = await this.channexReq(key, 'POST', `/channels/${channelId}/activate`, {})
    if (actRes.ok) steps.activate = true

    this.logger.info('Canal OTA creado', { channel: dto.channel, channelId })
    return {
      success: true,
      message: `Canal ${dto.channel} creado y ${steps.activate ? 'activado' : 'pendiente de activación'}`,
      channelId,
      steps,
    }
  }

  async deactivateChannel(cfg: CanalesDTO | undefined, channelId: string): Promise<{ success: boolean; message: string }> {
    const key = this.resolveKey(cfg)
    const res = await this.channexReq(key, 'POST', `/channels/${channelId}/deactivate`, {})
    if (!res.ok) return { success: false, message: res.data?.errors?.title || 'Error al desactivar canal' }
    return { success: true, message: 'Canal desactivado' }
  }

  // ─── Channel detail ──────────────────────────────────────────────────
  async getChannelDetail(cfg: CanalesDTO | undefined, channelId: string): Promise<any | null> {
    const key = this.resolveKey(cfg)
    const ch = await this.channexReq(key, 'GET', `/channels/${channelId}`)
    if (!ch.ok || !ch.data?.data) return null
    const channel = ch.data.data.attributes || ch.data.data

    const rps: any[] = []
    if (cfg?.channexPropertyId) {
      try {
        const rpRes = await this.channexReq(key, 'GET', `/rate_plans?filter[property_id]=${cfg.channexPropertyId}`)
        rps.push(...(rpRes.data?.data || []))
      } catch {}
      try {
        const rtRes = await this.channexReq(key, 'GET', `/room_types?filter[property_id]=${cfg.channexPropertyId}`)
        rps.forEach((rp: any) => {
          const a = rp.attributes || rp
          const rt = (rtRes.data?.data || []).find((r: any) => (r.attributes || r).id === a.room_type_id)
          a.room_type_title = (rt?.attributes || rt)?.title || '—'
        })
      } catch {}
    }

    return {
      id: channel.id || channelId,
      title: channel.title,
      channel: channel.channel,
      isActive: channel.is_active,
      ratePlans: channel.rate_plans || [],
      settings: channel.settings || {},
      allRatePlans: rps.map((rp: any) => {
        const a = rp.attributes || rp
        const opts = a.options || []
        return {
          id: rp.id, title: a.title, roomTypeId: a.room_type_id,
          roomTypeTitle: a.room_type_title || '—', occupancy: opts[0]?.occupancy || 2,
        }
      }),
    }
  }

  // ─── iFrame ───────────────────────────────────────────────────────────
  async generateIframeToken(cfg: CanalesDTO | undefined, username: string): Promise<string | null> {
    const key = this.resolveKey(cfg)
    if (!cfg?.channexPropertyId) return null
    const res = await this.channexReq(key, 'POST', '/auth/one_time_token', {
      one_time_token: {
        property_id: cfg.channexPropertyId,
        group_id: cfg.channexGroupId || undefined,
        username,
      },
    })
    return res.data?.data?.token || null
  }

  // ─── Bookings ─────────────────────────────────────────────────────────
  async fetchBookingFeed(key: string): Promise<BookingRevisionDTO[]> {
    const res = await this.channexReq(key, 'GET', '/booking_revisions/feed?limit=50')
    const raw = res.data?.data || []
    if (!Array.isArray(raw)) return []
    return raw.map((r: any) => {
      const a = r.attributes || r
      return {
        id: r.id || a.id,
        propertyId: a.property_id,
        bookingId: a.booking_id,
        uniqueId: a.unique_id,
        otaReservationCode: a.ota_reservation_code,
        otaName: a.ota_name,
        status: a.status,
        arrivalDate: a.arrival_date,
        departureDate: a.departure_date,
        amount: a.amount,
        currency: a.currency,
        customer: a.customer || {},
        rooms: (a.rooms || []).map((rm: any) => ({
          roomTypeId: rm.room_type_id || null,
          ratePlanId: rm.rate_plan_id || null,
          checkinDate: rm.checkin_date,
          checkoutDate: rm.checkout_date,
          amount: rm.amount,
          occupancy: rm.occupancy || { adults: 1, children: 0, infants: 0 },
        })),
        insertedAt: a.inserted_at,
      }
    })
  }

  async ackBooking(key: string, revisionId: string): Promise<boolean> {
    const res = await this.channexReq(key, 'POST', `/booking_revisions/${revisionId}/ack`, {})
    return res.ok
  }

  async ingestBookings(cfg: CanalesDTO | undefined, createReserva: (dto: any) => Promise<any>): Promise<BookingIngestionResult> {
    const key = this.resolveKey(cfg)
    const result: BookingIngestionResult = { success: true, message: '', ingested: 0, acknowledged: 0, errors: [] }

    try {
      const bookings = await this.fetchBookingFeed(key)
      if (bookings.length === 0) {
        result.message = 'No hay bookings pendientes'
        return result
      }

      for (const booking of bookings) {
        try {
          const reserva = {
            hotelId: cfg?.hotelId,
            canal: booking.otaName,
            otaReservationCode: booking.otaReservationCode,
            checkIn: booking.arrivalDate,
            checkOut: booking.departureDate,
            montoTotal: parseFloat(booking.amount) || 0,
            moneda: booking.currency,
            estado: booking.status === 'cancelled' ? 'cancelada' : 'confirmada',
            huespedNombre: [booking.customer?.name, booking.customer?.surname].filter(Boolean).join(' ') || 'OTA Guest',
            huespedEmail: booking.customer?.mail || '',
            huespedTelefono: booking.customer?.phone || '',
            notas: `OTA: ${booking.otaName} | ${booking.uniqueId}`,
            metadata: JSON.stringify({ channexRevisionId: booking.id, channexBookingId: booking.bookingId, rooms: booking.rooms }),
          }
          await createReserva(reserva)
          result.ingested++

          const acked = await this.ackBooking(key, booking.id)
          if (acked) result.acknowledged++
          else result.errors.push(`No se pudo ack booking ${booking.uniqueId}`)
        } catch (e: any) {
          result.errors.push(`${booking.uniqueId}: ${e.message}`)
        }
      }

      result.message = `${result.ingested} reservas ingesadas, ${result.acknowledged} acknowledged`
    } catch (e: any) {
      result.success = false
      result.message = e.message || 'Error al ingestar bookings'
    }

    return result
  }
}
