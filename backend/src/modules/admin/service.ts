import type { RepositoryAdapter, Logger } from 'arckode-framework'
import type { AdminAnalyticsDTO, MonitoringDTO, PlanDTO, AmenityCatalogDTO } from './types'

const PLAN_PRICE: Record<string, number> = { enterprise: 199, professional: 99, starter: 49, essential: 49 }
const BYTES_PER_MB = 1024 * 1024

export class AdminService {
  constructor(
    private readonly plansRepo: RepositoryAdapter<PlanDTO>,
    private readonly amenitiesRepo: RepositoryAdapter<AmenityCatalogDTO>,
    private readonly orm: any,
    private readonly logger: Logger,
    private readonly auth?: any,
  ) {}

  async listHotels(): Promise<{ data: any[]; total: number }> {
    const data = await this.orm.findMany('Hotels', {})
    return { data, total: data.length }
  }

  async listUsers(): Promise<{ data: any[]; total: number }> {
    const data = await this.orm.findMany('Users', {})
    return { data: data.map(({ password: _pw, ...rest }: any) => rest), total: data.length }
  }

  async getAnalytics(): Promise<AdminAnalyticsDTO> {
    const hs = await this.orm.findMany('Hotels', {})
    const us = await this.orm.findMany('Users', {})
    const rs = await this.orm.findMany('Reservations', {})
    return {
      mrr: hs.reduce((s: number, h: any) => s + (PLAN_PRICE[String(h.plan).toLowerCase()] ?? 49), 0),
      totalHoteles: hs.length, totalUsuarios: us.length, totalReservas: rs.length,
      activeHotels: hs.filter((h: any) => h.status === 'active').length,
      byPlan: hs.reduce((a: any, h: any) => ((a[h.plan] = (a[h.plan] || 0) + 1), a), {}),
      avgOccupancy: 0, npsScore: 0, ticketPromedio: 0, monthlyRevenue: [],
    }
  }

  async listSubscriptions(): Promise<{ data: any[]; total: number; mrrTotal: number }> {
    const data = (await this.orm.findMany('Hotels', {})).map((h: any) => ({ ...h, mrr: PLAN_PRICE[String(h.plan).toLowerCase()] ?? 49 }))
    return { data, total: data.length, mrrTotal: data.reduce((s: number, h: any) => s + h.mrr, 0) }
  }

  async listAuditLogs(): Promise<{ data: any[]; total: number }> {
    const data = await this.orm.findMany('Auditlog', {})
    return { data, total: data.length }
  }

  async listAnnouncements(): Promise<{ data: any[]; total: number }> {
    const data = await this.orm.findMany('Announcements', {})
    return { data, total: data.length }
  }

  async getMonitoring(): Promise<MonitoringDTO> {
    const tickets = await this.orm.findMany('Tickets', {}) as any[]
    return {
      hoteles: await this.orm.count('Hotels'),
      usuarios: await this.orm.count('Users'),
      reservas: await this.orm.count('Reservations'),
      ticketsAbiertos: tickets.filter((t: any) => t.status === 'open').length,
      ticketsEnProgreso: tickets.filter((t: any) => t.status === 'in_progress').length,
      ticketsUrgentes: tickets.filter((t: any) => t.priority === 'high' || t.priority === 'urgent').length,
      ticketsResueltos: tickets.filter((t: any) => t.status === 'closed').length,
      uptime: process.uptime(),
      memoria: Math.round(process.memoryUsage().rss / BYTES_PER_MB),
    }
  }

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
      limits: body.limits || { rooms: 30, users: 2, properties: 1 },
      isActive: body.isActive !== false ? 1 : 0, sortOrder: body.sortOrder || 0,
    })
  }

  async updatePlan(id: string, body: any, user?: any): Promise<any> {
    const existing = await this.plansRepo.findById(id) as any
    if (!existing) throw new Error('Plan no encontrado')
    if (this.auth) this.auth.assertOwnership(existing, { role: 'super_admin' })
    const patch: Record<string, any> = {}
    for (const k of ['name', 'price', 'currency', 'description', 'features', 'limits', 'isActive', 'sortOrder']) {
      if (body[k] !== undefined) patch[k] = k === 'isActive' ? (body[k] ? 1 : 0) : body[k]
    }
    if (body.name) patch.slug = body.name.toLowerCase().replace(/\s+/g, '-')
    return await this.plansRepo.update(id, patch)
  }

  async deletePlan(id: string, user?: any): Promise<void> {
    const existing = await this.plansRepo.findById(id) as any
    if (!existing) throw new Error('Plan no encontrado')
    if (this.auth) this.auth.assertOwnership(existing, { role: 'super_admin' })
    await this.plansRepo.delete(id)
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
    if (this.auth) this.auth.assertOwnership(existing, { role: 'super_admin' })
    const patch: Record<string, any> = {}
    for (const k of ['key', 'label', 'category', 'icon', 'isActive', 'sortOrder']) {
      if (body[k] !== undefined) patch[k] = k === 'isActive' ? (body[k] ? 1 : 0) : body[k]
    }
    return await this.amenitiesRepo.update(id, patch)
  }

  async deleteAmenityCatalog(id: string, user?: any): Promise<void> {
    const existing = await this.amenitiesRepo.findById(id) as any
    if (!existing) throw new Error('Amenity no encontrado')
    if (this.auth) this.auth.assertOwnership(existing, { role: 'super_admin' })
    await this.amenitiesRepo.delete(id)
  }

  async getPublicUsers(): Promise<any[]> {
    const rows = (await this.orm.findMany('Users', { isDemo: 1, active: 1 })) as any[]
    return rows.filter((u: any) => u && u.email).map((u: any) => ({ name: u.name, email: u.email, role: u.role }))
  }
}
