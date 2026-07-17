// canales/index.ts — PUERTA PÚBLICA
// Solo esto es visible para otros módulos y conectores.
// ⚠ REGLA: Append-only. No sacar ni modificar exports existentes.

import { createModule, OrmRepository } from 'arckode-framework'
import { registerCanalesModels } from './model'
import { CanalesService } from './service'
import { CanalesController } from './controller'
import { CanalesQueries } from './usecases/canales-queries'
import { ConfigUseCase } from './usecases/config'
import { ChannexUseCase } from './usecases/channex'
import { ChannexAdminService } from './service-channex-admin'
import type { RoomTypeSummary, CanalesDTO } from './types'
import { createPermissionGuard } from '../../infrastructure/auth/create-permission-guard'
import { requireUserType } from '../../infrastructure/auth/require-user-type'
import { resolveTenant } from '../../shared/utils/resolve-tenant'

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
      actions: ['list', 'getById', 'create', 'update', 'delete', 'channels', 'feed', 'sync', 'pushRate', 'pushAvailability', 'pushAvailabilityByRoom', 'testConnection', 'mappingDetails', 'groups', 'connectOTA', 'deactivateChannel'],
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
      const userRepo = new OrmRepository<any>(orm, 'Users')
      const log = logger.child('canales')
      const syncLogRepo = new OrmRepository<any>(orm, 'SyncLog')
      const queries = new CanalesQueries(orm)
      const service = new CanalesService(repo, userRepo, log, cache, auth, queries, syncLogRepo)
      const controller = new CanalesController(service, log)

      const roleRepo = new OrmRepository<any>(orm, 'Roles')
      const guard = createPermissionGuard(auth, roleRepo)

      // ── Config Channex a nivel PLATAFORMA (super_admin) — white-label: una cuenta para todos ──
      const adminConfig = new ConfigUseCase(repo, queries)
      const adminChannex = new ChannexUseCase(log, () => adminConfig.getPlatformChannex())
      const channexAdmin = new ChannexAdminService(adminConfig, adminChannex)
      const adminOnly = [auth.authenticate('super_admin'), requireUserType('admin')]
      router.get('/api/admin/channex-config', adminOnly, async () => ({ status: 200, body: await channexAdmin.getStatus() }))
      router.put('/api/admin/channex-config', adminOnly, async (req: any) => ({ status: 200, body: await channexAdmin.save(req.body || {}) }))
      router.post('/api/admin/channex-config/test', adminOnly, async () => ({ status: 200, body: await channexAdmin.test() }))

      router.get('/api/channels', guard('channel-manager', 'view'), async (req) => {
        // resolveTenant (no resolveHotelId del cliente): el merchant queda forzado a su hotel; solo
        // super_admin puede targetear otro. Antes filtraba el channexPropertyId de cualquier hotel.
        const hotelId = resolveTenant(req)
        if (!hotelId) return { status: 404, body: { error: 'Hotel no encontrado' } }
        return { status: 200, body: await service.listChannels(hotelId) }
      })
      router.get('/api/channels/feed', guard('channel-manager', 'view'), (req) => controller.feed())

      router.post('/api/channels/test-connection', guard('channel-manager', 'edit'), (req) => controller.testConnection(req))
      router.get('/api/channels/mapping-details', guard('channel-manager', 'view'), (req) => controller.mappingDetails(req))
      router.get('/api/channels/groups', guard('channel-manager', 'view'), (req) => controller.groups(req))
      router.post('/api/channels/connect', guard('channel-manager', 'edit'), (req) => controller.connectOTA(req))
      router.post('/api/channels/:id/deactivate', guard('channel-manager', 'edit'), (req) => controller.deactivate(req))
      router.get('/api/channels/:id/detail', guard('channel-manager', 'view'), (req) => controller.channelDetail(req))

      router.get('/api/channels/bookings', guard('channel-manager', 'view'), (req) => controller.bookings(req))
      router.post('/api/channels/bookings/ingest', guard('channel-manager', 'edit'), (req) => controller.ingestBookings(req))

      router.get('/api/channels/iframe-token', guard('channel-manager', 'view'), (req) => controller.iframeToken(req))

      router.post('/api/channels/sync', guard('channel-manager', 'edit'), async (req) => {
        // resolveTenant, NO el hotelId del cliente: syncProperty es DESTRUCTIVO (borra rate_plans y
        // room_types en Channex antes de recrear). Con el hotelId del body, un merchant de A lo
        // disparaba sobre la cuenta Channex de B con las credenciales de B → oversell / caída de OTAs.
        const hotelId = resolveTenant(req)
        if (!hotelId) return { status: 404, body: { error: 'Hotel no encontrado' } }
        const hotels = await queries.findMany('Hotels', { id: hotelId })
        const hotel = hotels[0] as any
        if (!hotel) return { status: 404, body: { error: 'Hotel no encontrado' } }
        const rooms = await queries.findMany('Rooms', { hotelId }) as any[]
        const seen = new Map<string, RoomTypeSummary>()
        for (const r of rooms) {
          const cur = seen.get(r.type)
          if (cur) cur.cnt++
          else seen.set(r.type, { type: r.type, basePrice: r.basePrice, capacity: r.capacity, cnt: 1 })
        }
        const result = await service.syncProperty(hotelId, hotel, [...seen.values()])
        return { status: 200, body: result }
      })

      router.get('/api/canales', guard('channel-manager', 'view'), (req) => controller.index(req))
      router.get('/api/canales/:id', guard('channel-manager', 'view'), (req) => controller.show(req))
      router.post('/api/canales', guard('channel-manager', 'edit'), (req) => controller.store(req))
      router.put('/api/canales/:id', guard('channel-manager', 'edit'), (req) => controller.update(req))
      router.delete('/api/canales/:id', guard('channel-manager', 'edit'), (req) => controller.destroy(req))

      router.get('/api/channels/sync-log', guard('channel-manager', 'view'), (req) => controller.syncLog(req))

      log.info('Módulo canales (Channex) listo')
      return service
    },
  })
}
