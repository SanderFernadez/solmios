// hotelmedia/index.ts — PUERTA PÚBLICA del módulo hotel_media.
// ⚠ REGLA: Append-only. No sacar ni modificar exports existentes.
//
// Scope F0 (tasks 0.6 + 0.7): modelo ORM + service + usecases. Las RUTAS admin
// (`/api/hotel-media` GET/POST/PUT/DELETE/reorder) y la ruta pública
// `/api/public/hotels/:slug/media` se agregan en la task 0.8 (otra pieza). Acá solo
// wiring: registra el modelo, construye repos + service, y los deja listos para que
// la task 0.8 cuelgue el controller + router.
import { createModule, OrmRepository } from 'arckode-framework'
import type { StorageService } from 'arckode-framework/modules/storage'
import { registerHotelMediaModels } from './model'
import { HotelMediaService } from './service'
import type { HotelMediaDTO } from './types'

export { HotelMediaService }
export type {
  HotelMediaDTO, CreateHotelMediaDTO, UpdateHotelMediaDTO, ReorderHotelMediaDTO,
  MediaType, CurrentUser,
} from './types'
export {
  HotelMediaValidator,
  CreateHotelMediaSchema, UpdateHotelMediaSchema, ReorderHotelMediaSchema,
} from './validators/schema'
export { registerHotelMediaModels } from './model'

/**
 * Factory del módulo hotel_media.
 * `storage` es opcional: si no se pasa, `upload` con data-URL fallará con
 * `ValidationError` claro (no crash). Es lo que permite testear sin storage.
 */
export function HotelMediaModule(opts: { storage?: StorageService } = {}) {
  return createModule({
    name: 'hotel-media',
    version: '1.0.0',
    description: 'Media del hotel (hero/gallery/room) para landing pública — F0',

    contract: {
      name: 'hotel-media',
      version: '1.0.0',
      description: 'Media del hotel (hero/gallery/room)',
      actions: ['listByHotel', 'upload', 'update', 'remove', 'reorder'],
      events: [],
      tables: ['hotel_media'],
      dependencies: [],
      rules: [
        'Ownership por hotelId (auth.assertOwnership post-find)',
        'type=room exige roomId del mismo hotel',
        'sortOrder consecutivo sin gaps (reorder 0..N-1)',
        'Reuso de S3StorageAdapter con dir hotel-media/',
      ],
    },

    create({ logger, orm, auth }) {
      if (!auth) throw new Error('hotel-media: auth dependency required')
      registerHotelMediaModels(orm)

      const media = new OrmRepository<HotelMediaDTO>(orm, 'HotelMedia')
      const rooms = new OrmRepository<any>(orm, 'Rooms')
      const userRepo = new OrmRepository<any>(orm, 'Users')
      const log = logger.child('hotel-media')
      const service = new HotelMediaService(media, rooms, userRepo, log, auth, opts.storage)

      // Task 0.8 (paralela) registra acá las rutas:
      //   GET    /api/hotel-media           — lista con ?type=
      //   POST   /api/hotel-media           — crear/upload
      //   PUT    /api/hotel-media/:id       — update
      //   DELETE /api/hotel-media/:id       — remove
      //   POST   /api/hotel-media/reorder   — reordenar
      //   GET    /api/public/hotels/:slug/media — pública agrupada

      log.info('Módulo hotel-media listo (sin rutas — task 0.8 pendiente)')
      return service
    },
  })
}
