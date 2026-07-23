// restaurant/controller.ts — Adaptador HTTP. Traduce request → service → response.
// SIN lógica de negocio, SIN ORM directo. Toda mutación pasa por validateSchema().
import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from '../../shared/validators/validate-body'
import type { RestaurantService } from './service'
import { CreateStationSchema, UpdateStationSchema } from './validators/schema'

export class RestaurantController {
  constructor(
    private readonly service: RestaurantService,
    private readonly logger: Logger,
  ) {}

  // ─── Estaciones (RES-0) ───
  async indexStations(req: HttpRequest) {
    this.logger.info('GET /restaurant/stations')
    const result = await this.service.listStations(req.user as any)
    return { status: 200, body: result }
  }

  async showStation(req: HttpRequest) {
    this.logger.info('GET /restaurant/stations/:id', { id: req.params.id })
    const item = await this.service.getStation(req.params.id, req.user as any)
    return { status: 200, body: item }
  }

  async storeStation(req: HttpRequest) {
    this.logger.info('POST /restaurant/stations')
    const data = validateSchema(CreateStationSchema, req.body)
    const item = await this.service.createStation(data as any, req.user as any)
    return { status: 201, body: item }
  }

  async updateStation(req: HttpRequest) {
    this.logger.info('PUT /restaurant/stations/:id', { id: req.params.id })
    const data = validateSchema(UpdateStationSchema, req.body)
    const item = await this.service.updateStation(req.params.id, data as any, req.user as any)
    return { status: 200, body: item }
  }

  async destroyStation(req: HttpRequest) {
    this.logger.info('DELETE /restaurant/stations/:id', { id: req.params.id })
    await this.service.deleteStation(req.params.id, req.user as any)
    return { status: 204, body: null }
  }
}
