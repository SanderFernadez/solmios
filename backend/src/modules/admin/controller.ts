import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { AdminService } from './service'
import { CreatePlanSchema, UpdatePlanSchema, CreateAmenityCatalogSchema, UpdateAmenityCatalogSchema, UpdateHotelAdminSchema } from './validators/schema'

export class AdminController {
  constructor(
    private readonly service: AdminService,
    private readonly logger: Logger,
  ) {}

  async listHotels() {
    return { status: 200, body: await this.service.listHotels() }
  }

  async listUsers() {
    return { status: 200, body: await this.service.listUsers() }
  }

  async getAnalytics() {
    return { status: 200, body: await this.service.getAnalytics() }
  }

  async listSubscriptions() {
    return { status: 200, body: await this.service.listSubscriptions() }
  }

  async listAuditLogs() {
    return { status: 200, body: await this.service.listAuditLogs() }
  }

  async listAnnouncements() {
    return { status: 200, body: await this.service.listAnnouncements() }
  }

  async getMonitoring() {
    return { status: 200, body: await this.service.getMonitoring() }
  }

  async listPlans() {
    return { status: 200, body: await this.service.listPlans() }
  }

  // validateSchema del framework SOLO maneja string/number/boolean/date → DESCARTA los campos
  // array/object (features, modules, limits). Se re-inyectan del body crudo (el service los whitelistea).
  private mergeComplexPlanFields(data: any, body: any): any {
    const b = body ?? {}
    if (Array.isArray(b.features)) data.features = b.features
    if (Array.isArray(b.modules)) data.modules = b.modules
    if (b.limits && typeof b.limits === 'object') data.limits = b.limits
    return data
  }

  async createPlan(req: HttpRequest) {
    try {
      const data = this.mergeComplexPlanFields(validateSchema(CreatePlanSchema, req.body) as any, req.body)
      const plan = await this.service.createPlan(data)
      return { status: 201, body: plan }
    } catch (e: any) {
      return { status: 400, body: { error: e.message } }
    }
  }

  async updatePlan(req: HttpRequest) {
    try {
      const data = this.mergeComplexPlanFields(validateSchema(UpdatePlanSchema, req.body) as any, req.body)
      return { status: 200, body: await this.service.updatePlan(req.params.id, data, req.user as any) }
    } catch (e: any) {
      return { status: e.message.includes('no encontrado') ? 404 : 400, body: { error: e.message } }
    }
  }

  async deletePlan(req: HttpRequest) {
    try {
      await this.service.deletePlan(req.params.id, req.user as any)
      return { status: 200, body: { success: true } }
    } catch (e: any) {
      return { status: 404, body: { error: e.message } }
    }
  }

  async updateHotel(req: HttpRequest) {
    try {
      const data = validateSchema(UpdateHotelAdminSchema, req.body) as any
      return { status: 200, body: await this.service.updateHotel(req.params.id, data, req.user as any) }
    } catch (e: any) {
      const msg = e.message || 'Error'
      const status = msg.includes('no encontrado') ? 404 : (msg.includes('no existe') ? 400 : 400)
      return { status, body: { error: msg } }
    }
  }

  async listAmenitiesCatalog() {
    return { status: 200, body: await this.service.listAmenitiesCatalog() }
  }

  async createAmenityCatalog(req: HttpRequest) {
    try {
      const data = validateSchema(CreateAmenityCatalogSchema, req.body) as any
      return { status: 201, body: await this.service.createAmenityCatalog(data) }
    } catch (e: any) {
      return { status: 409, body: { error: e.message } }
    }
  }

  async updateAmenityCatalog(req: HttpRequest) {
    try {
      const data = validateSchema(UpdateAmenityCatalogSchema, req.body) as any
      return { status: 200, body: await this.service.updateAmenityCatalog(req.params.id, data, req.user as any) }
    } catch (e: any) {
      return { status: 404, body: { error: e.message } }
    }
  }

  async deleteAmenityCatalog(req: HttpRequest) {
    try {
      await this.service.deleteAmenityCatalog(req.params.id, req.user as any)
      return { status: 200, body: { success: true } }
    } catch (e: any) {
      return { status: 404, body: { error: e.message } }
    }
  }

  async getPublicUsers() {
    return { status: 200, body: await this.service.getPublicUsers() }
  }
}
