export async function getDashboardAnalytics(orm: any): Promise<any> {
  const hs = await orm.findMany('Hotels', {})
  const us = await orm.findMany('Users', {})
  const rs = await orm.findMany('Reservations', {})
  const PLAN_PRICE: Record<string, number> = { enterprise: 199, professional: 99, starter: 49, essential: 49 }
  return {
    mrr: hs.reduce((s: number, h: any) => s + (PLAN_PRICE[String(h.plan).toLowerCase()] ?? 49), 0),
    totalHoteles: hs.length, totalUsuarios: us.length, totalReservas: rs.length,
    activeHotels: hs.filter((h: any) => h.status === 'active').length,
    byPlan: hs.reduce((a: any, h: any) => ((a[h.plan] = (a[h.plan] || 0) + 1), a), {}),
    avgOccupancy: 0, npsScore: 0, ticketPromedio: 0, monthlyRevenue: [],
  }
}

export async function getMonitoringData(orm: any): Promise<any> {
  const tickets = await orm.findMany('Tickets', {}) as any[]
  const BYTES_PER_MB = 1024 * 1024
  return {
    hoteles: await orm.count('Hotels'),
    usuarios: await orm.count('Users'),
    reservas: await orm.count('Reservations'),
    ticketsAbiertos: tickets.filter((t: any) => t.status === 'open').length,
    ticketsEnProgreso: tickets.filter((t: any) => t.status === 'in_progress').length,
    ticketsUrgentes: tickets.filter((t: any) => t.priority === 'high' || t.priority === 'urgent').length,
    ticketsResueltos: tickets.filter((t: any) => t.status === 'closed').length,
    uptime: process.uptime(),
    memoria: Math.round(process.memoryUsage().rss / BYTES_PER_MB),
  }
}
