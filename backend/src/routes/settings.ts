// src/routes/settings.ts — Settings routes (amenities, seasons, rates, blocks, etc.)
import type { ORM, Auth } from 'arckode-framework'

export function registerSettingsRoutes(router: any, orm: ORM, auth: Auth) {
  // ─── Amenities ─────────────────────────────────────────────────────
  router.get('/api/amenities/catalog', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], async () => {
    const catalog = {
      interior: ['ac', 'heating', 'kitchen', 'microwave', 'fridge', 'coffee_maker', 'washer', 'dishwasher', 'tv', 'wifi', 'safe', 'minibar', 'hair_dryer', 'iron', 'balcony', 'bathtub', 'work_desk'],
      exterior: ['pool', 'pool_heated', 'parking_free', 'parking_paid', 'gym', 'spa', 'restaurant', 'bar', 'garden', 'terrace', 'bbq', 'elevator', 'lounge', 'kids_playground'],
      services: ['room_service', 'laundry', 'concierge', 'luggage_storage', 'pets_allowed', 'wheelchair_access'],
    }
    return { status: 200, body: catalog }
  })

  router.get('/api/amenities/hotel', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], async (req: any) => {
    const id = await hotelOf(req, orm)
    const data = await orm.findMany('HotelAmenities', { hotelId: id, isActive: 1 }) as any[]
    return { status: 200, body: { data } }
  })

  router.put('/api/amenities/hotel', [auth.authenticate('hotel_admin', 'super_admin')], async (req: any) => {
    const id = await hotelOf(req, orm)
    const { amenities } = req.body as any
    if (!Array.isArray(amenities)) return { status: 400, body: { error: 'amenities debe ser un array' } }
    const existing = await orm.findMany('HotelAmenities', { hotelId: id }) as any[]
    for (const ex of existing) { if (!amenities.includes(ex.amenityKey)) await orm.update('HotelAmenities', ex.id, { isActive: 0 }) }
    for (const key of amenities) {
      const found = existing.find((e: any) => e.amenityKey === key)
      if (found) { await orm.update('HotelAmenities', found.id, { isActive: 1 }) }
      else {
        const cat = key.includes('pool') || key.includes('parking') || key.includes('gym') || key.includes('spa') || key.includes('restaurant') || key.includes('bar') || key.includes('garden') || key.includes('terrace') || key.includes('bbq') || key.includes('kids') ? 'exterior'
          : key.includes('service') || key.includes('laundry') || key.includes('concierge') || key.includes('pets') || key.includes('wheelchair') ? 'services' : 'interior'
        await orm.create('HotelAmenities', { id: crypto.randomUUID(), hotelId: id, amenityKey: key, amenityCategory: cat, isActive: 1 })
      }
    }
    return { status: 200, body: { success: true, count: amenities.length } }
  })

  router.get('/api/amenities/room/:roomId', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], async (req: any) => {
    const data = await orm.findMany('RoomAmenities', { roomId: req.params.roomId, isActive: 1 }) as any[]
    return { status: 200, body: { data } }
  })

  router.put('/api/amenities/room/:roomId', [auth.authenticate('hotel_admin', 'super_admin')], async (req: any) => {
    const { amenities } = req.body as any
    if (!Array.isArray(amenities)) return { status: 400, body: { error: 'amenities debe ser un array' } }
    const existing = await orm.findMany('RoomAmenities', { roomId: req.params.roomId }) as any[]
    for (const ex of existing) { if (!amenities.includes(ex.amenityKey)) await orm.update('RoomAmenities', ex.id, { isActive: 0 }) }
    for (const key of amenities) {
      const found = existing.find((e: any) => e.amenityKey === key)
      if (found) { await orm.update('RoomAmenities', found.id, { isActive: 1 }) }
      else { await orm.create('RoomAmenities', { id: crypto.randomUUID(), roomId: req.params.roomId, amenityKey: key, isShared: 0, isActive: 1 }) }
    }
    return { status: 200, body: { success: true, count: amenities.length } }
  })

  // ─── Seasons ───────────────────────────────────────────────────────
  router.get('/api/seasons', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], async (req: any) => {
    const id = await hotelOf(req, orm)
    const data = await orm.findMany('Seasons', { hotelId: id }) as any[]
    return { status: 200, body: { data: data.sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0)) } }
  })

  router.put('/api/seasons', [auth.authenticate('hotel_admin', 'super_admin')], async (req: any) => {
    const id = await hotelOf(req, orm)
    const { seasons } = req.body as any
    if (!Array.isArray(seasons)) return { status: 400, body: { error: 'seasons debe ser un array' } }
    const existing = await orm.findMany('Seasons', { hotelId: id }) as any[]
    for (const ex of existing) await orm.delete('Seasons', ex.id)
    for (let i = 0; i < seasons.length; i++) {
      const s = seasons[i]
      await orm.create('Seasons', { id: crypto.randomUUID(), hotelId: id, name: s.name || `season-${i}`, label: s.label || '', startDate: s.startDate || '', endDate: s.endDate || '', color: s.color || '#3b82f6', sortOrder: i })
    }
    return { status: 200, body: { success: true, count: seasons.length } }
  })

  // ─── Rates ─────────────────────────────────────────────────────────
  router.get('/api/rates', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], async (req: any) => {
    const id = await hotelOf(req, orm)
    const data = await orm.findMany('RoomRates', { hotelId: id }) as any[]
    return { status: 200, body: { data } }
  })

  router.put('/api/rates', [auth.authenticate('hotel_admin', 'super_admin')], async (req: any) => {
    const id = await hotelOf(req, orm)
    const { rates } = req.body as any
    if (!Array.isArray(rates)) return { status: 400, body: { error: 'rates debe ser un array' } }
    let saved = 0
    for (const r of rates) {
      if (!r.roomType || !r.season || r.occupancy === undefined) continue
      const basePrice = r.basePrice ?? 0
      const percentage = r.percentage ?? 0
      const price = Math.round(basePrice * (1 + percentage / 100) * 100) / 100
      const closed = r.closed ? 1 : 0
      const existing = (await orm.findMany('RoomRates', { hotelId: id, roomType: r.roomType, occupancy: r.occupancy, season: r.season }))[0] as any
      if (existing) { await orm.update('RoomRates', existing.id, { basePrice, percentage, price, closed }) }
      else { await orm.create('RoomRates', { id: crypto.randomUUID(), hotelId: id, roomType: r.roomType, occupancy: r.occupancy, season: r.season, basePrice, percentage, price, closed }) }
      saved++
    }
    return { status: 200, body: { success: true, count: saved } }
  })

  router.post('/api/rates/copy-next-year', [auth.authenticate('hotel_admin', 'super_admin')], async (req: any) => {
    const id = await hotelOf(req, orm)
    const rates = await orm.findMany('RoomRates', { hotelId: id }) as any[]
    let copied = 0
    for (const r of rates) {
      const nextYear = String(r.season || '').replace(/\d{4}/, String(new Date().getFullYear() + 1))
      const exists = (await orm.findMany('RoomRates', { hotelId: id, roomType: r.roomType, occupancy: r.occupancy, season: nextYear }))[0]
      if (!exists) { await orm.create('RoomRates', { id: crypto.randomUUID(), hotelId: id, roomType: r.roomType, occupancy: r.occupancy, season: nextYear, price: r.price, basePrice: r.basePrice, percentage: r.percentage }); copied++ }
    }
    return { status: 200, body: { success: true, copied, total: rates.length } }
  })

  // ─── Room Blocks ───────────────────────────────────────────────────
  router.get('/api/blocks', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], async (req: any) => {
    const id = await hotelOf(req, orm)
    const { startDate, endDate } = req.query as any
    let data = await orm.findMany('RoomBlocks', { hotelId: id }) as any[]
    if (startDate && endDate) data = data.filter((b: any) => b.startDate <= endDate && b.endDate >= startDate)
    return { status: 200, body: { data } }
  })

  router.post('/api/blocks', [auth.authenticate('hotel_admin', 'super_admin')], async (req: any) => {
    const id = await hotelOf(req, orm)
    const { roomIds, reason, startDate, endDate } = req.body as any
    if (!roomIds?.length || !startDate || !endDate) return { status: 400, body: { error: 'roomIds, startDate, endDate requeridos' } }
    const created: any[] = []
    for (const roomId of roomIds) {
      created.push(await orm.create('RoomBlocks', { id: crypto.randomUUID(), hotelId: id, roomId, reason: reason || '', startDate, endDate, createdBy: (req.user as any)?.id || '' }))
    }
    return { status: 201, body: { data: created, count: created.length } }
  })

  router.delete('/api/blocks/:id', [auth.authenticate('hotel_admin', 'super_admin')], async (req: any) => {
    await orm.delete('RoomBlocks', req.params.id)
    return { status: 200, body: { success: true } }
  })

  // ─── Settings / Hotel ──────────────────────────────────────────────
  router.get('/api/settings', [auth.authenticate('hotel_admin', 'super_admin')], async (req: any) => {
    const id = await hotelOf(req, orm)
    const hotel = (await orm.findMany('Hotels', { id }))[0] as any
    const rooms = await orm.findMany('Rooms', { hotelId: id })
    const seen = new Set<string>(); const baseRates: any[] = []
    for (const r of rooms as any[]) { if (!seen.has(r.type)) { seen.add(r.type); baseRates.push({ type: r.type, price: r.basePrice }) } }
    return { status: 200, body: { hotel, baseRates } }
  })

  router.put('/api/settings/hotel', [auth.authenticate('hotel_admin', 'super_admin')], async (req: any) => {
    const id = (req.body as any).id || (await hotelOf(req, orm))
    const body = req.body as any
    const safePatch: Record<string, any> = {}
    const allowed = ['name', 'country', 'address', 'phone', 'email', 'timezone', 'currency', 'checkIn', 'checkOut', 'plan', 'freeCancellation', 'depositRequired', 'depositPercent', 'weekendSurcharge', 'ownerName', 'ownerTaxId', 'deviceEmail', 'accommodationType', 'registrationNumber', 'website', 'bookingEngineUrl', 'phone2', 'warningPhone', 'secondaryCurrency', 'youtubeUrl', 'starRating', 'onlineBookingStatus', 'motorVersion', 'latitude', 'longitude', 'province', 'municipality', 'locality', 'postalCode', 'cleaningType', 'depositType', 'depositFixed', 'advanceType', 'advanceAmount', 'releaseHours', 'defaultPaymentMethod', 'requestReviews', 'publishReviewScore', 'publishReviewComments', 'taxName', 'taxRate', 'descriptionJson', 'wifiNetwork', 'wifiPassword']
    for (const k of allowed) { if (body[k] !== undefined) safePatch[k] = body[k] }
    await orm.update('Hotels', id, safePatch)
    return { status: 200, body: await orm.findById('Hotels', id) }
  })

  router.get('/api/settings/full', [auth.authenticate('hotel_admin', 'super_admin')], async (req: any) => {
    const id = await hotelOf(req, orm); if (!id) return { status: 404, body: { error: 'Sin hotel' } }
    const hotel = (await orm.findById('Hotels', id)) as any
    const [amenities, seasons, rates, blocks, autoMessages] = await Promise.all([
      orm.findMany('HotelAmenities', { hotelId: id, isActive: 1 }) as Promise<any[]>,
      orm.findMany('Seasons', { hotelId: id }) as Promise<any[]>,
      orm.findMany('RoomRates', { hotelId: id }) as Promise<any[]>,
      orm.findMany('RoomBlocks', { hotelId: id }) as Promise<any[]>,
      // ⚠️ DEBT: AutoMessages migrated to modules/marketing. This raw ORM call should be replaced with system.resolveModule('marketing').listAutoMessages(id)
      orm.findMany('AutoMessages', { hotelId: id }) as Promise<any[]>,
    ])
    const rooms = await orm.findMany('Rooms', { hotelId: id }) as any[]
    const roomTypes = [...new Set(rooms.map((r: any) => r.type || 'standard'))]
    const ttlockCfg = (await orm.findMany('Configuration', { hotelId: id, key: 'ttlock_config' }))[0] as any
    const ttlock = ttlockCfg ? safeParse(ttlockCfg.value) : {}
    return { status: 200, body: {
      hotel, amenities: amenities.map((a: any) => a.amenityKey),
      seasons: seasons.sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0)),
      rates, blocks, autoMessages, roomTypes,
      ttlock: { ...ttlock, configured: !!(ttlock?.clientId && ttlock?.clientSecret) },
    } }
  })

  // ─── Configuracion ─────────────────────────────────────────────────
  router.get('/api/configuracion/:key', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], async (req: any) => {
    const id = await hotelOf(req, orm)
    const row = (await orm.findMany('Configuration', { hotelId: id, key: req.params.key }))[0] as any
      || (await orm.findMany('Configuration', { hotelId: 'platform', key: req.params.key }))[0] as any
    return { status: 200, body: { valor: row ? safeParse(row.value) : null } }
  })

  router.post('/api/configuracion', [auth.authenticate('hotel_admin', 'super_admin')], async (req: any) => {
    const body = req.body as any
    const { clave, valor, hotelId } = body
    if (!clave || valor === undefined) return { status: 400, body: { error: 'clave y valor requeridos' } }
    const existing = (await orm.findMany('Configuration', { hotelId: hotelId || 'platform', key: clave }))[0] as any
    const val = typeof valor === 'object' ? JSON.stringify(valor) : String(valor)
    if (existing) { await orm.update('Configuration', existing.id, { value: val }) }
    else { await orm.create('Configuration', { id: crypto.randomUUID(), hotelId: hotelId || 'platform', key: clave, value: val }) }
    return { status: 200, body: { success: true } }
  })

  // ─── Message Logs ──────────────────────────────────────────────────
  router.get('/api/message-logs', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], async (req: any) => {
    const id = await hotelOf(req, orm)
    const { reservationId } = req.query as any
    const query: any = { hotelId: id }
    if (reservationId) query.reservationId = reservationId
    const data = await orm.findMany('MessageLogs', query) as any[]
    return { status: 200, body: { data: data.sort((a: any, b: any) => (b.sentAt || '').localeCompare(a.sentAt || '')) } }
  })

  // ─── Sync History (Channel Manager) ──────────────────────────────────
  router.get('/api/sync-log', [auth.authenticate('hotel_admin', 'super_admin')], async (req: any) => {
    const id = await hotelOf(req, orm)
    const data = await orm.findMany('SyncLog', { hotelId: id }) as any[]
    return { status: 200, body: { data: data.sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || '')) } }
  })

  router.post('/api/sync-log', [auth.authenticate('hotel_admin', 'super_admin')], async (req: any) => {
    const id = await hotelOf(req, orm)
    const body = req.body as any
    const entry = await orm.create('SyncLog', {
      id: crypto.randomUUID(), hotelId: id,
      channel: body.channel || 'channex',
      action: body.action || 'sync',
      status: body.status || 'success',
      details: body.details || {},
      createdAt: new Date().toISOString(),
    })
    return { status: 201, body: entry }
  })

  // ─── Rate Restrictions (min_stay, max_stay, cta, ctd) ────────────────
  router.get('/api/rate-restrictions', [auth.authenticate('hotel_admin', 'super_admin')], async (req: any) => {
    const id = await hotelOf(req, orm)
    const data = await orm.findMany('RateRestrictions', { hotelId: id }) as any[]
    return { status: 200, body: { data } }
  })

  router.put('/api/rate-restrictions', [auth.authenticate('hotel_admin', 'super_admin')], async (req: any) => {
    const id = await hotelOf(req, orm)
    const { restrictions } = req.body as any
    if (!Array.isArray(restrictions)) return { status: 400, body: { error: 'restrictions debe ser un array' } }
    let saved = 0
    for (const r of restrictions) {
      if (!r.roomType || !r.season) continue
      const existing = (await orm.findMany('RateRestrictions', { hotelId: id, roomType: r.roomType, season: r.season }))[0] as any
      if (existing) {
        await orm.update('RateRestrictions', existing.id, {
          minStay: r.minStay ?? 0, maxStay: r.maxStay ?? 0,
          cta: r.cta ?? 0, ctd: r.ctd ?? 0,
          closedToArrival: r.closedToArrival ?? 0, closedToDeparture: r.closedToDeparture ?? 0,
        })
      } else {
        await orm.create('RateRestrictions', {
          id: crypto.randomUUID(), hotelId: id, roomType: r.roomType, season: r.season,
          minStay: r.minStay ?? 0, maxStay: r.maxStay ?? 0,
          cta: r.cta ?? 0, ctd: r.ctd ?? 0,
          closedToArrival: r.closedToArrival ?? 0, closedToDeparture: r.closedToDeparture ?? 0,
        })
      }
      saved++
    }
    return { status: 200, body: { success: true, count: saved } }
  })

  // ─── Channel Metrics (ADR/RevPAR por canal) ──────────────────────────
  router.get('/api/channel-metrics', [auth.authenticate('hotel_admin', 'super_admin')], async (req: any) => {
    const id = await hotelOf(req, orm)
    const reservations = await orm.findMany('Reservations', { hotelId: id }) as any[]
    const rooms = await orm.findMany('Rooms', { hotelId: id }) as any[]

    // Agrupar por canal
    const byChannel: Record<string, { count: number; revenue: number; nights: number }> = {}
    for (const r of reservations) {
      const ch = r.channel || 'direct'
      if (!byChannel[ch]) byChannel[ch] = { count: 0, revenue: 0, nights: 0 }
      byChannel[ch].count++
      byChannel[ch].revenue += r.totalAmount || 0
      const ci = new Date(String(r.checkIn).slice(0, 10)).getTime()
      const co = new Date(String(r.checkOut).slice(0, 10)).getTime()
      byChannel[ch].nights += co > ci ? Math.round((co - ci) / 86400000) : 0
    }

    // Calcular métricas por canal
    const metrics = Object.entries(byChannel).map(([channel, data]) => ({
      channel,
      bookings: data.count,
      revenue: data.revenue,
      adr: data.nights > 0 ? Math.round(data.revenue / data.nights) : 0,
      revpar: rooms.length > 0 ? Math.round(data.revenue / rooms.length) : 0,
      avgStay: data.count > 0 ? (data.nights / data.count).toFixed(1) : '0',
    }))

    return { status: 200, body: { data: metrics } }
  })
}

async function hotelOf(req: any, orm: ORM): Promise<string | undefined> {
  const q = req?.query || {}
  if (q.hotelId) return q.hotelId as string
  const userHotel = req?.user?.hotelId
  if (userHotel && userHotel !== 'platform') return userHotel as string
  if (req?.user?.id && req?.user?.role !== 'super_admin') {
    const uRows = await orm.findMany('Users', { id: req.user.id })
    const u: any = (uRows as any[])?.[0]
    if (u?.hotelId) return u.hotelId
  }
  const hotels = await orm.findMany('Hotels', {})
  return (hotels as any[])?.[0]?.id
}

function safeParse(v: any) { if (typeof v !== 'string') return v; try { return JSON.parse(v) } catch { return v } }
