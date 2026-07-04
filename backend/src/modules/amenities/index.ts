import { createModule, OrmRepository } from 'arckode-framework'
import { AmenitiesService } from './service'
import { AmenitiesController } from './controller'
import { createPermissionGuard } from '../../infrastructure/auth/create-permission-guard'

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
      const hotelAmenitiesRepo = new OrmRepository<any>(orm, 'HotelAmenities')
      const roomAmenitiesRepo = new OrmRepository<any>(orm, 'RoomAmenities')
      const service = new AmenitiesService(hotelAmenitiesRepo, roomAmenitiesRepo, log)
      const controller = new AmenitiesController(service, log)

      const roleRepo = new OrmRepository<any>(orm, 'Roles')
      const guard = createPermissionGuard(auth, roleRepo)

      router.get('/api/amenities/catalog', guard('settings', 'view'), () => controller.getCatalog())
      router.get('/api/amenities/hotel', guard('settings', 'view'), (req: any) => controller.listHotel(req))
      router.put('/api/amenities/hotel', guard('settings', 'edit'), (req: any) => controller.updateHotel(req))
      router.get('/api/amenities/room/:roomId', guard('settings', 'view'), (req: any) => controller.listRoom(req))
      router.put('/api/amenities/room/:roomId', guard('settings', 'edit'), (req: any) => controller.updateRoom(req))

      log.info('Módulo amenities listo')
      return service
    },
  })
}
