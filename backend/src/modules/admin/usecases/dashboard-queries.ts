const PLAN_PRICE: Record<string, number> = { enterprise: 199, professional: 99, starter: 49, essential: 49 }
const BYTES_PER_MB = 1024 * 1024

export class DashboardQueries {
  constructor(private readonly orm: any) {}

  async listHotels(): Promise<{ data: any[]; total: number }> {
    const data = await this.orm.findMany('Hotels', {})
    return { data, total: data.length }
  }

  async listUsers(): Promise<{ data: any[]; total: number }> {
    const data = await this.orm.findMany('Users', {})
    return { data: data.map((u: any) => { const { password, ...rest } = u; return rest }), total: data.length }
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

  async getPublicUsers(): Promise<any[]> {
    const rows = (await this.orm.findMany('Users', { isDemo: 1, active: 1 })) as any[]
    return rows.filter((u: any) => u && u.email).map((u: any) => ({ name: u.name, email: u.email, role: u.role }))
  }

  async getAnalytics(): Promise<any> {
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

  async getMonitoring(): Promise<any> {
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
}
