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

  /**
   * Suscripción REAL de cada hotel a la plataforma (tabla `subscriptions` + `plans`), no el
   * `hotels.plan` de texto libre con un precio inventado en `PLAN_PRICE`. Antes esta consulta
   * ignoraba por completo el módulo `subscriptions`: el super-admin veía "Pagado" para
   * cualquier hotel con estado `active` en `hotels` (nada que ver con el cobro de Stripe) y un
   * MRR que sumaba el precio de planes que nadie facturó. `mrr` acá solo cuenta lo que
   * REALMENTE está `active` en Stripe — `trialing`/`past_due`/`expired`/`canceled` no suman.
   */
  async listSubscriptions(): Promise<{ data: any[]; total: number; mrrTotal: number }> {
    const hotels = await this.orm.findMany('Hotels', {})
    const subs = await this.orm.findMany('Subscriptions', {}) as any[]
    const plans = await this.orm.findMany('Plans', {}) as any[]
    const subByHotel = new Map(subs.map((s: any) => [s.hotelId, s]))
    const planById = new Map(plans.map((p: any) => [p.id, p]))

    const data = hotels.map((h: any) => {
      const sub = subByHotel.get(h.id)
      const plan = sub?.planId ? planById.get(sub.planId) : undefined
      const status = sub?.status ?? 'none'
      return {
        hotelId: h.id,
        hotelName: h.name,
        status,
        planId: sub?.planId ?? '',
        planName: plan?.name ?? '',
        trialEndsAt: sub?.trialEndsAt ?? null,
        currentPeriodEnd: sub?.currentPeriodEnd ?? null,
        canceledAt: sub?.canceledAt ?? null,
        hasStripeCustomer: !!sub?.stripeCustomerId,
        mrr: status === 'active' ? Number(plan?.price ?? 0) : 0,
        specialCategory: sub?.specialCategory ?? null,
      }
    })
    return { data, total: data.length, mrrTotal: data.reduce((s: number, r: any) => s + r.mrr, 0) }
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
    // Solo expone usuarios DEMO (name/email/role, sin id ni credenciales). Fail-closed: en
    // producción, o si NODE_ENV no está seteado (deploy mal configurado), no devuelve nada salvo
    // DEMO_LOGIN=1 explícito. Así una config sin NODE_ENV no filtra la lista de cuentas demo.
    const env = process.env.NODE_ENV
    if ((env === 'production' || !env) && process.env.DEMO_LOGIN !== '1') return []
    const rows = (await this.orm.findMany('Users', { isDemo: 1, active: 1 })) as any[]
    return rows.filter((u: any) => u && u.email).map((u: any) => ({ name: u.name, email: u.email, role: u.role }))
  }

  /** Últimos N meses como buckets ordenados (viejo → nuevo). */
  private lastNMonths(n: number): { key: string; label: string }[] {
    const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    const now = new Date()
    const out: { key: string; label: string }[] = []
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      out.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: MONTHS[d.getMonth()] })
    }
    return out
  }

  /** Clave `YYYY-MM` de una fecha ISO; null si no parsea. */
  private monthKeyOf(raw: any): string | null {
    if (!raw) return null
    const d = new Date(String(raw))
    if (Number.isNaN(d.getTime())) return null
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
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

    // Ingresos mensuales reales (últimos 6 meses) — suma de totalAmount de reservas activas por mes.
    // Se agrupa por createdAt (cuándo entró la reserva); si falta, cae a checkIn.
    const REVENUE_STATUSES = ['confirmed', 'checked_in', 'checked_out']
    const buckets = this.lastNMonths(6)
    const revByMonth: Record<string, number> = {}
    for (const r of rs) {
      if (!REVENUE_STATUSES.includes(r.status)) continue
      const key = this.monthKeyOf(r.createdAt) ?? this.monthKeyOf(r.checkIn)
      if (!key) continue
      revByMonth[key] = (revByMonth[key] || 0) + Number(r.totalAmount || 0)
    }
    const monthlyRevenue = buckets.map((b) => ({ label: b.label, value: Math.round(revByMonth[b.key] || 0) }))

    // MRR por plan (para el revenue de "Distribución por Plan")
    const byPlanRevenue: Record<string, number> = {}
    for (const h of hs) {
      const plan = String(h.plan || 'essential')
      byPlanRevenue[plan] = (byPlanRevenue[plan] || 0) + (PLAN_PRICE[plan.toLowerCase()] ?? 49)
    }

    // Trends reales: altas de este mes vs el anterior (crecimiento del período).
    const [prevKey, curKey] = [buckets[4].key, buckets[5].key]
    const createdIn = (rows: any[], key: string): number =>
      rows.filter((x: any) => this.monthKeyOf(x.createdAt) === key).length
    const pct = (cur: number, prev: number): number =>
      prev > 0 ? Math.round(((cur - prev) / prev) * 100) : (cur > 0 ? 100 : 0)
    const trends = {
      hoteles: pct(createdIn(hs, curKey), createdIn(hs, prevKey)),
      usuarios: pct(createdIn(us, curKey), createdIn(us, prevKey)),
      reservas: pct(createdIn(rs, curKey), createdIn(rs, prevKey)),
      mrr: pct(monthlyRevenue[5].value, monthlyRevenue[4].value),
    }

    return {
      mrr: hs.reduce((s: number, h: any) => s + (PLAN_PRICE[String(h.plan).toLowerCase()] ?? 49), 0),
      totalHoteles: hs.length, totalUsuarios: us.length, totalReservas: rs.length,
      activeHotels: hs.filter((h: any) => h.status === 'active').length,
      byPlan: hs.reduce((a: any, h: any) => ((a[h.plan] = (a[h.plan] || 0) + 1), a), {}),
      byPlanRevenue,
      avgOccupancy, avgADR, hotelsBreakdown,
      topByRevenue: [...hotelsBreakdown].sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 5),
      topByOccupancy: [...hotelsBreakdown].sort((a: any, b: any) => b.occupancy - a.occupancy).slice(0, 5),
      npsScore: 0, ticketPromedio: 0, monthlyRevenue, trends,
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
