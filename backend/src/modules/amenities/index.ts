import { createModule } from 'arckode-framework'
import { AmenitiesService } from './service'
import { AmenitiesController } from './controller'

export { AmenitiesService }

export function AmenitiesModule() {
  return createModule({
    name: 'amenities',
    version: '1.0.0',
    description: 'Amenities catalog, hotel amenities, room amenities',
    contract: {
      name: 'amenities', version: '1.0.0',
      description: 'Amenities management',
      actions: ['getCatalog', 'listHotel', 'updateHotel', 'listRoom', 'updateRoom'],
      events: [],
      tables: ['hotel_amenities', 'room_amenities'],
      dependencies: [],
      rules: [],
    },
    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('amenities: auth dependency required')
      const log = logger.child('amenities')
      const service = new AmenitiesService(orm, log)
      const controller = new AmenitiesController(service, log)

      const hsa = [auth.authenticate('hotel_admin', 'super_admin')]
      const hra = [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')]

      router.get('/api/amenities/catalog', hra, () => controller.getCatalog())
      router.get('/api/amenities/hotel', hra, (req: any) => controller.listHotel(req))
      router.put('/api/amenities/hotel', hsa, (req: any) => controller.updateHotel(req))
      router.get('/api/amenities/room/:roomId', hra, (req: any) => controller.listRoom(req))
      router.put('/api/amenities/room/:roomId', hsa, (req: any) => controller.updateRoom(req))

      log.info('Módulo amenities listo')
      return service
    },
  })
}
