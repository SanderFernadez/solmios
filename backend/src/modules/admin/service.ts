import type { RepositoryAdapter, Logger } from 'arckode-framework'
import type { AdminAnalyticsDTO, MonitoringDTO, PlanDTO, AmenityCatalogDTO } from './types'
import type { DashboardQueries } from './usecases/dashboard-queries'
import {
  auditSafely, planDeleteEntry, amenityCatalogDeleteEntry, type AuditPort,
} from './usecases/audit'

/**
 * Planes y catálogo de amenities son recursos de la plataforma: no pertenecen a ningún hotel ni
 * usuario. `assertOwnership(dueño, solicitante, rol, rolAdmin)` sale bien por una de dos puertas:
 * que el solicitante SEA el dueño, o que tenga el rol de admin. Este centinela nunca va a coincidir
 * con un `user.id`, así que cierra la primera puerta y deja sólo la del rol.
 *
 * Antes se llamaba `assertOwnership(existing, { role: 'super_admin' })` — dos objetos, `===` siempre
 * false y sin rol: lanzaba Forbidden hasta para el super_admin. Editar un plan era imposible.
 */
const PLATFORM_RESOURCE = '__platform__'

export class AdminService {
  private auditPort: AuditPort | null = null

  /** Conecta el audit log. Lo inyecta el connector `admin-auditlog`. */
  setAuditDeps(port: AuditPort): void {
    this.auditPort = port
  }

  constructor(
    private readonly plansRepo: RepositoryAdapter<PlanDTO>,
    private readonly amenitiesRepo: RepositoryAdapter<AmenityCatalogDTO>,
    private readonly logger: Logger,
    private readonly auth?: any,
    private readonly queries?: DashboardQueries,
  ) {}

  async listHotels(): Promise<{ data: any[]; total: number }> { return this.queries!.listHotels() }
  async listUsers(): Promise<{ data: any[]; total: number }> { return this.queries!.listUsers() }
  async getAnalytics(): Promise<AdminAnalyticsDTO> { return this.queries!.getAnalytics() }
  async listSubscriptions(): Promise<{ data: any[]; total: number; mrrTotal: number }> { return this.queries!.listSubscriptions() }
  async listAuditLogs(): Promise<{ data: any[]; total: number }> { return this.queries!.listAuditLogs() }
  async listAnnouncements(): Promise<{ data: any[]; total: number }> { return this.queries!.listAnnouncements() }
  async getMonitoring(): Promise<MonitoringDTO> { return this.queries!.getMonitoring() }
  async getPublicUsers(): Promise<any[]> { return this.queries!.getPublicUsers() }

  async listPlans(): Promise<{ data: any[]; total: number }> {
    const data = await this.plansRepo.findMany({})
    return { data: data as any[], total: data.length }
  }

  async createPlan(body: any): Promise<any> {
    if (!body.name || !body.price) throw new Error('name y price requeridos')
    return await this.plansRepo.create({
      name: body.name,
      slug: body.name.toLowerCase().replace(/\s+/g, '-'),
      price: Number(body.price), currency: body.currency || 'USD',
      description: body.description || '', features: body.features || [],
      modules: Array.isArray(body.modules) ? body.modules : [],
      limits: body.limits || { rooms: 30, users: 2, properties: 1 },
      isActive: body.isActive !== false ? 1 : 0, sortOrder: body.sortOrder || 0,
    })
  }

  async updatePlan(id: string, body: any, user?: any): Promise<any> {
    const existing = await this.plansRepo.findById(id) as any
    if (!existing) throw new Error('Plan no encontrado')
    if (this.auth) this.auth.assertOwnership(PLATFORM_RESOURCE, user?.id ?? '', user?.role, 'super_admin')
    const patch: Record<string, any> = {}
    for (const k of ['name', 'price', 'currency', 'description', 'features', 'modules', 'limits', 'isActive', 'sortOrder']) {
      if (body[k] !== undefined) patch[k] = k === 'isActive' ? (body[k] ? 1 : 0) : body[k]
    }
    if (body.name) patch.slug = body.name.toLowerCase().replace(/\s+/g, '-')
    return await this.plansRepo.update(id, patch)
  }

  async deletePlan(id: string, user?: any): Promise<void> {
    const existing = await this.plansRepo.findById(id) as any
    if (!existing) throw new Error('Plan no encontrado')
    if (this.auth) this.auth.assertOwnership(PLATFORM_RESOURCE, user?.id ?? '', user?.role, 'super_admin')
    await this.plansRepo.delete(id)
    await auditSafely(this.auditPort, this.logger, planDeleteEntry(existing, user))
  }

  async listAmenitiesCatalog(): Promise<{ data: any[]; total: number }> {
    const data = await this.amenitiesRepo.findMany({})
    return { data: data as any[], total: data.length }
  }

  async createAmenityCatalog(body: any): Promise<any> {
    if (!body.key || !body.label) throw new Error('key y label requeridos')
    const existing = (await this.amenitiesRepo.findMany({ key: body.key }))[0]
    if (existing) throw new Error('Amenity ya existe')
    return await this.amenitiesRepo.create({
      key: body.key, label: body.label,
      category: body.category || 'interior', icon: body.icon || '',
      isActive: body.isActive !== false ? 1 : 0, sortOrder: body.sortOrder || 0,
    })
  }

  async updateAmenityCatalog(id: string, body: any, user?: any): Promise<any> {
    const existing = await this.amenitiesRepo.findById(id) as any
    if (!existing) throw new Error('Amenity no encontrado')
    if (this.auth) this.auth.assertOwnership(PLATFORM_RESOURCE, user?.id ?? '', user?.role, 'super_admin')
    const patch: Record<string, any> = {}
    for (const k of ['key', 'label', 'category', 'icon', 'isActive', 'sortOrder']) {
      if (body[k] !== undefined) patch[k] = k === 'isActive' ? (body[k] ? 1 : 0) : body[k]
    }
    return await this.amenitiesRepo.update(id, patch)
  }

  async deleteAmenityCatalog(id: string, user?: any): Promise<void> {
    const existing = await this.amenitiesRepo.findById(id) as any
    if (!existing) throw new Error('Amenity no encontrado')
    if (this.auth) this.auth.assertOwnership(PLATFORM_RESOURCE, user?.id ?? '', user?.role, 'super_admin')
    await this.amenitiesRepo.delete(id)
    await auditSafely(this.auditPort, this.logger, amenityCatalogDeleteEntry(existing, user))
  }
}
