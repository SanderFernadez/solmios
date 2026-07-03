import type { HttpRequest, Logger, Auth, RepositoryAdapter } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { ReservasService } from './service'
import { CreateReservasSchema, UpdateReservasSchema, CompanionSchema, AddonSchema } from './validators/schema'
import { listCompanions, createCompanion, updateCompanion, deleteCompanion } from './usecases/companions'
import { listAddons, createAddon, deleteAddon } from './usecases/addons'

export class ReservasController {
  constructor(
    private readonly service: ReservasService,
    private readonly logger: Logger,
    private readonly companionsRepo: RepositoryAdapter<any>,
    private readonly addonsRepo: RepositoryAdapter<any>,
    private readonly reservationRepo: RepositoryAdapter<any>,
    private readonly userRepo: RepositoryAdapter<any>,
    private readonly auth: Auth,
  ) {}

  // ── CRUD reservas (/api/reservas) ──
  async index(req: HttpRequest) {
    const result = await this.service.list(req.query as any, req.user as any)
    return { status: 200, body: result }
  }
  async show(req: HttpRequest) {
    const item = await this.service.getById(req.params.id, req.user as any)
    return { status: 200, body: item }
  }
  async store(req: HttpRequest) {
    const data = validateSchema(CreateReservasSchema, req.body)
    const item = await this.service.create(data as any, req.user as any)
    return { status: 201, body: item }
  }
  async update(req: HttpRequest) {
    const data = validateSchema(UpdateReservasSchema, req.body)
    const item = await this.service.update(req.params.id, data as any, req.user as any)
    return { status: 200, body: item }
  }
  async destroy(req: HttpRequest) {
    await this.service.delete(req.params.id, req.user as any)
    return { status: 204, body: null }
  }

  // ── Companions (/api/reservations/:id/companions, /api/companions/:id) — F2 ──
  async listCompanions(req: HttpRequest) {
    const data = await listCompanions(this.companionsRepo, req.params.id)
    return { status: 200, body: { data } }
  }
  async createCompanion(req: HttpRequest) {
    const dto = validateSchema(CompanionSchema, req.body) as any
    const c = await createCompanion(this.companionsRepo, this.reservationRepo, this.userRepo, this.auth, req.params.id, dto, req.user as any)
    return { status: 201, body: c }
  }
  async updateCompanion(req: HttpRequest) {
    const dto = validateSchema(CompanionSchema, req.body) as any
    const c = await updateCompanion(this.companionsRepo, this.reservationRepo, this.userRepo, this.auth, req.params.id, dto, req.user as any)
    return { status: 200, body: c }
  }
  async deleteCompanion(req: HttpRequest) {
    await deleteCompanion(this.companionsRepo, this.reservationRepo, this.userRepo, this.auth, req.params.id, req.user as any)
    return { status: 200, body: { success: true } }
  }

  // ── Addons (/api/reservations/:id/addons, /api/addons/:id) — F2 ──
  async listAddons(req: HttpRequest) {
    const data = await listAddons(this.addonsRepo, req.params.id)
    return { status: 200, body: { data } }
  }
  async createAddon(req: HttpRequest) {
    const dto = validateSchema(AddonSchema, req.body) as any
    const a = await createAddon(this.addonsRepo, this.reservationRepo, this.userRepo, this.auth, req.params.id, dto, req.user as any)
    return { status: 201, body: a }
  }
  async deleteAddon(req: HttpRequest) {
    await deleteAddon(this.addonsRepo, this.reservationRepo, this.userRepo, this.auth, req.params.id, req.user as any)
    return { status: 200, body: { success: true } }
  }
}
