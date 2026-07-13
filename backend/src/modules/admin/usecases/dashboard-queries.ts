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
    // Seguridad (V6): endpoint público sin auth (alimenta los botones de login demo, pre-auth).
    // Solo expone usuarios DEMO (name/email/role, sin id ni credenciales). En producción queda
    // deshabilitado por defecto; para mostrar los botones demo en prod, setear DEMO_LOGIN=1.
    if (process.env.NODE_ENV === 'production' && process.env.DEMO_LOGIN !== '1') return []
    const rows = (await this.orm.findMany('Users', { isDemo: 1, active: 1 })) as any[]
    return rows.filter((u: any) => u && u.email).map((u: any) => ({ name: u.name, email: u.email, role: u.role }))
  }

  async getAnalytics(): Promise<any> {
    const hs = await this.orm.findMany('Hotels', {})
    const us = await this.orm.findMany('Users', {})
    const rs = await this.orm.findMany('Reservations', {})
    const rooms = await this.orm.findMany('Rooms', {})
    const MS_PER_DAY = 86_400_000
    const nights = (a: any, b: any): number => {
      if (!a || !b) return 0
      const d1 = new Date(String(a).slice(0, 10)).getTime()
      const d2 = new Date(String(b).slice(0, 10)).getTime()
      return d2 > d1 ? Math.round((d2 - d1) / MS_PER_DAY) : 0
    }
    // PC-2.2 — desglose por hotel con ocupación/ADR reales (cross-hotel)
    const hotelsBreakdown = hs.map((h: any) => {
      const hRooms = rooms.filter((r: any) => r.hotelId === h.id)
      const hRes = rs.filter((r: any) => r.hotelId === h.id && ['confirmed', 'checked_in'].includes(r.status))
      const revenue = hRes.reduce((s: number, r: any) => s + Number(r.totalAmount || 0), 0)
      const nightsSold = hRes.reduce((s: number, r: any) => s + nights(r.checkIn, r.checkOut), 0)
      return {
        id: h.id, name: h.name, plan: h.plan || 'essential', status: h.status || 'active',
        mrr: PLAN_PRICE[String(h.plan).toLowerCase()] ?? 49,
        rooms: hRooms.length, reservations: hRes.length,
        occupancy: hRooms.length > 0 ? Math.min(100, Math.round((hRes.length / hRooms.length) * 100)) : 0,
        adr: nightsSold > 0 ? Math.round(revenue / nightsSold) : 0,
        revenue,
      }
    })
    const activeBreakdown = hotelsBreakdown.filter((h: any) => h.status === 'active')
    const avgOccupancy = activeBreakdown.length > 0
      ? Math.round(activeBreakdown.reduce((s: number, h: any) => s + h.occupancy, 0) / activeBreakdown.length)
      : 0
    const totalRevenue = rs.reduce((s: number, r: any) => s + Number(r.totalAmount || 0), 0)
    const totalNightsSold = rs.reduce((s: number, r: any) => s + nights(r.checkIn, r.checkOut), 0)
    const avgADR = totalNightsSold > 0 ? Math.round(totalRevenue / totalNightsSold) : 0
    return {
      mrr: hs.reduce((s: number, h: any) => s + (PLAN_PRICE[String(h.plan).toLowerCase()] ?? 49), 0),
      totalHoteles: hs.length, totalUsuarios: us.length, totalReservas: rs.length,
      activeHotels: hs.filter((h: any) => h.status === 'active').length,
      byPlan: hs.reduce((a: any, h: any) => ((a[h.plan] = (a[h.plan] || 0) + 1), a), {}),
      avgOccupancy, avgADR, hotelsBreakdown,
      topByRevenue: [...hotelsBreakdown].sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 5),
      topByOccupancy: [...hotelsBreakdown].sort((a: any, b: any) => b.occupancy - a.occupancy).slice(0, 5),
      npsScore: 0, ticketPromedio: 0, monthlyRevenue: [],
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
