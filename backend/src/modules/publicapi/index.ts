// publicapi/index.ts — PUERTA PÚBLICA
// Solo esto es visible para otros módulos y conectores.
// ⚠ REGLA: Append-only. No sacar ni modificar exports existentes.
//
// Módulo SIN tabla propia (ver model.ts): expone rooms/reservations de habitaciones/reservas a
// integraciones externas autenticadas por API key. Los datos los provee el connector
// `publicapi-reservas` (composition-root.ts) vía `service.setDeps(...)` — publicapi nunca importa
// habitaciones/reservas directamente.
//
// Auth: EXCLUSIVAMENTE `apiKeyAuth` (x-api-key), NUNCA JWT. No usa `createPermissionGuard` ni
// `auth.authenticate()` — esta es la única superficie de la API que no lleva sesión de usuario.

import { createModule } from 'arckode-framework'
import { registerPublicapiModels } from './model'
import { PublicapiService } from './service'
import { PublicapiController } from './controller'
import { apiKeyAuth } from '../../infrastructure/auth/api-key-auth'

export { PublicapiService }
export type {
  PublicRoomAvailabilityDTO, PublicRoomsQuery, CreatePublicReservationDTO, PublicReservationDTO,
  PublicApiAuthContext, PublicApiRoomsPort, PublicApiReservationsPort,
} from './types'
export type { PublicapiSockets } from './sockets'
export { PublicapiValidator, CreatePublicReservationSchema } from './validators/schema'

export function PublicapiModule() {
  return createModule({
    name: 'publicapi',
    version: '1.0.0',
    description: 'API pública v1 (rooms/reservations) para integraciones externas autenticadas por API key',

    contract: {
      name: 'publicapi',
      version: '1.0.0',
      description: 'Public API v1: disponibilidad de habitaciones + reservas, auth por x-api-key',
      actions: ['listRooms', 'createReservation', 'getReservation'],
      events: [],
      tables: [],
      dependencies: ['habitaciones', 'reservas'], // vía connector `publicapi-reservas`, nunca import directo
      rules: [
        'Auth exclusiva por x-api-key (sin JWT) — infrastructure/auth/api-key-auth.ts',
        'setDeps(...) inyectado por el connector publicapi-reservas',
        'Ownership: getReservation valida que la reserva pertenezca al hotelId de la key',
      ],
    },

    create({ logger, orm, router }) {
      registerPublicapiModels(orm)

      const log = logger.child('publicapi')
      const service = new PublicapiService(log)
      const controller = new PublicapiController(service, log)
      const apiKeyGuard = apiKeyAuth(orm)

      router.get('/api/public/v1/rooms', [apiKeyGuard], (req) => controller.listRooms(req))
      router.post('/api/public/v1/reservations', [apiKeyGuard], (req) => controller.createReservation(req))
      router.get('/api/public/v1/reservations/:id', [apiKeyGuard], (req) => controller.getReservation(req))

      log.info('Módulo publicapi listo (auth por x-api-key, sin JWT)')
      return service
    },
  })
}
