// canales/index.ts — PUERTA PÚBLICA
// Solo esto es visible para otros módulos y conectores.
// ⚠ REGLA: Append-only. No sacar ni modificar exports existentes.

import { createModule, OrmRepository } from 'arckode-framework'
import { registerCanalesModels } from './model'
import { CanalesService } from './service'
import { CanalesController } from './controller'
import type { RoomTypeSummary, CanalesDTO } from './types'

export { CanalesService }
export type { CanalesDTO, CreateCanalesDTO, UpdateCanalesDTO, CanalesQuery, CanalesPaginated, ChannelsResultDTO, ChannelDTO, SyncResultDTO, RoomTypeSummary, TestConnectionDTO, TestConnectionResultDTO, MappingDetailDTO, MappingRateDTO, OTAChannelCreateDTO, OTAChannelMappingDTO, OTAChannelResultDTO, GroupDTO } from './types'
export type { CanalesSockets } from './sockets'
export { CanalesValidator, CreateCanalesSchema, UpdateCanalesSchema } from './validators/schema'

export function CanalesModule() {
  return createModule({
    name: 'canales',
    version: '1.0.0',
    description: 'Channel manager (Channex) — sincroniza disponibilidad, tarifas y reservas con OTAs',

    contract: {
      name: 'canales',
      version: '1.0.0',
      description: 'Channel manager Channex',
      actions: ['list', 'getById', 'create', 'update', 'delete', 'channels', 'feed', 'sync', 'pushRate', 'testConnection', 'mappingDetails', 'groups', 'connectOTA', 'deactivateChannel'],
      events: ['onCanalesCreated', 'onCanalesUpdated', 'onCanalesDeleted', 'onCanalesSynced'],
      tables: ['canales_config'],
      dependencies: [],
      rules: ['No importar de otros módulos'],
    },

    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('canales: auth dependency required')
      // Registrar modelo(s) — delegado a model.ts
      registerCanalesModels(orm)

      const repo = new OrmRepository<CanalesDTO>(orm, 'Canales')
      const log = logger.child('canales')
      const service = new CanalesService(repo, log, cache, orm)
      const controller = new CanalesController(service, log)

      const resolveHotelId = async (q: any, body: any) =>
        body?.hotelId || q?.hotelId || ((await orm.findMany('Hotels', {}))[0] as any)?.id

      // ─── Channel manager (Channex real) ───────────────────────────────
      // hotelId se resuelve con fallback al primer hotel (igual que /sync) para
      // que GET /api/channels sin query explícita devuelva la config correcta.
      router.get('/api/channels', [auth.authenticate('hotel_admin', 'super_admin')], async (req) => {
        const hotelId = await resolveHotelId(req.query as any, {})
        return { status: 200, body: await service.listChannels(hotelId) }
      })
      router.get('/api/channels/feed', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.feed())

      // Channel API — conexión OTA (Expedia, Booking, etc.)
      router.post('/api/channels/test-connection', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.testConnection(req))
      router.get('/api/channels/mapping-details', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.mappingDetails(req))
      router.get('/api/channels/groups', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.groups(req))
      router.post('/api/channels/connect', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.connectOTA(req))
      router.post('/api/channels/:id/deactivate', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.deactivate(req))
      router.get('/api/channels/:id/detail', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.channelDetail(req))

      // Bookings — recepción de reservas OTA desde Channex
      router.get('/api/channels/bookings', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.bookings(req))
      router.post('/api/channels/bookings/ingest', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.ingestBookings(req))

      // iFrame — embed de Channex para mapear canales visualmente
      router.get('/api/channels/iframe-token', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.iframeToken(req))

      // POST /api/channels/sync — crea propiedad + room types + rate plans + ARI en Channex.
      // Lee habitaciones vía orm (cross-module read, igual que dashboard/reports).
      router.post('/api/channels/sync', [auth.authenticate('hotel_admin', 'super_admin')], async (req) => {
        const body = (req.body as any) || {}
        const hotelId = await resolveHotelId((req.query as any), body)
        if (!hotelId) return { status: 404, body: { error: 'Hotel no encontrado' } }
        const hotel = (await orm.findMany('Hotels', { id: hotelId }))[0] as any
        if (!hotel) return { status: 404, body: { error: 'Hotel no encontrado' } }
        // Agrupar habitaciones por tipo → resumen ARI.
        const rooms = (await orm.findMany('Rooms', { hotelId })) as any[]
        const seen = new Map<string, RoomTypeSummary>()
        for (const r of rooms) {
          const cur = seen.get(r.type)
          if (cur) cur.cnt++
          else seen.set(r.type, { type: r.type, basePrice: r.basePrice, capacity: r.capacity, cnt: 1 })
        }
        const result = await service.syncProperty(hotelId, hotel, [...seen.values()])
        return { status: 200, body: result }
      })

      // ─── CRUD admin sobre la config (opcional) ────────────────────────
      router.get('/api/canales', [auth.authenticate('super_admin')], (req) => controller.index(req))
      router.get('/api/canales/:id', [auth.authenticate('super_admin')], (req) => controller.show(req))
      router.post('/api/canales', [auth.authenticate('super_admin')], (req) => controller.store(req))
      router.put('/api/canales/:id', [auth.authenticate('super_admin')], (req) => controller.update(req))
      router.delete('/api/canales/:id', [auth.authenticate('super_admin')], (req) => controller.destroy(req))

      log.info('Módulo canales (Channex) listo')
      return service
    },
  })
}
