// src/routes/admin.ts — Super admin routes (platform management)
// Extraído de composition-root.ts para reducir tamaño (regla: <200 líneas por archivo).
import type { ORM, Auth, Logger } from 'arckode-framework'

const BYTES_PER_MB = 1024 * 1024
const PLAN_PRICE: Record<string, number> = { enterprise: 199, professional: 99, starter: 49, essential: 49 }

export function registerAdminRoutes(router: any, orm: ORM, auth: Auth, _logger: Logger) {

  router.get('/api/admin/hoteles', [auth.authenticate('super_admin')], async () => {
    const data = await orm.findMany('Hotels', {})
    return { status: 200, body: { data, total: data.length } }
  })

  router.get('/api/admin/users', [auth.authenticate('super_admin')], async () => {
    const data = await orm.findMany('Users', {})
    return { status: 200, body: { data: data.map((u: any) => ({ ...u, password: undefined })), total: data.length } }
  })

  router.get('/api/admin/analytics', [auth.authenticate('super_admin')], async () => {
    const hs = await orm.findMany('Hotels', {})
    const us = await orm.findMany('Users', {})
    const rs = await orm.findMany('Reservations', {})
    return { status: 200, body: {
      mrr: hs.reduce((s: number, h: any) => s + (PLAN_PRICE[String(h.plan).toLowerCase()] ?? 49), 0),
      totalHoteles: hs.length, totalUsuarios: us.length, totalReservas: rs.length,
      activeHotels: hs.filter((h: any) => h.status === 'active').length,
      byPlan: hs.reduce((a: any, h: any) => ((a[h.plan] = (a[h.plan] || 0) + 1), a), {}),
      avgOccupancy: 0, npsScore: 0, ticketPromedio: 0, monthlyRevenue: [],
    } }
  })

  router.get('/api/admin/subscriptions', [auth.authenticate('super_admin')], async () => {
    const data = (await orm.findMany('Hotels', {})).map((h: any) => ({ ...h, mrr: PLAN_PRICE[String(h.plan).toLowerCase()] ?? 49 }))
    return { status: 200, body: { data, total: data.length, mrrTotal: data.reduce((s: number, h: any) => s + h.mrr, 0) } }
  })

  router.get('/api/admin/audit', [auth.authenticate('super_admin')], async () => {
    const data = await orm.findMany('Auditlog', {}) as any[]
    return { status: 200, body: { data, total: data.length } }
  })

  router.get('/api/admin/announcements', [auth.authenticate('super_admin')], async () => {
    const data = await orm.findMany('Announcements', {})
    return { status: 200, body: { data, total: data.length } }
  })

  router.get('/api/admin/monitoring', [auth.authenticate('super_admin')], async () => {
    const tickets = await orm.findMany('Tickets', {}) as any[]
    return { status: 200, body: {
      hoteles: await orm.count('Hotels'),
      usuarios: await orm.count('Users'),
      reservas: await orm.count('Reservations'),
      ticketsAbiertos: tickets.filter((t: any) => t.status === 'open').length,
      ticketsEnProgreso: tickets.filter((t: any) => t.status === 'in_progress').length,
      ticketsUrgentes: tickets.filter((t: any) => t.priority === 'high' || t.priority === 'urgent').length,
      ticketsResueltos: tickets.filter((t: any) => t.status === 'closed').length,
      uptime: process.uptime(),
      memoria: Math.round(process.memoryUsage().rss / BYTES_PER_MB),
    } }
  })

  // ─── Plans CRUD ──────────────────────────────────────────────────────
  router.get('/api/admin/plans', [auth.authenticate('super_admin')], async () => {
    const data = await orm.findMany('Plans', {}) as any[]
    return { status: 200, body: { data, total: data.length } }
  })

  router.post('/api/admin/plans', [auth.authenticate('super_admin')], async (req: any) => {
    const body = req.body as any
    if (!body.name || !body.price) return { status: 400, body: { error: 'name y price requeridos' } }
    const plan = await orm.create('Plans', {
      id: crypto.randomUUID(), name: body.name,
      slug: body.name.toLowerCase().replace(/\s+/g, '-'),
      price: Number(body.price), currency: body.currency || 'USD',
      description: body.description || '', features: body.features || [],
      limits: body.limits || { rooms: 30, users: 2, properties: 1 },
      isActive: body.isActive !== false ? 1 : 0, sortOrder: body.sortOrder || 0,
    })
    return { status: 201, body: plan }
  })

  router.put('/api/admin/plans/:id', [auth.authenticate('super_admin')], async (req: any) => {
    const body = req.body as any
    const existing = await orm.findById('Plans', req.params.id) as any
    if (!existing) return { status: 404, body: { error: 'Plan no encontrado' } }
    const patch: Record<string, any> = {}
    for (const k of ['name', 'price', 'currency', 'description', 'features', 'limits', 'isActive', 'sortOrder']) {
      if (body[k] !== undefined) patch[k] = k === 'isActive' ? (body[k] ? 1 : 0) : body[k]
    }
    if (body.name) patch.slug = body.name.toLowerCase().replace(/\s+/g, '-')
    await orm.update('Plans', req.params.id, patch)
    return { status: 200, body: await orm.findById('Plans', req.params.id) }
  })

  router.delete('/api/admin/plans/:id', [auth.authenticate('super_admin')], async (req: any) => {
    const existing = await orm.findById('Plans', req.params.id) as any
    if (!existing) return { status: 404, body: { error: 'Plan no encontrado' } }
    await orm.delete('Plans', req.params.id)
    return { status: 200, body: { success: true } }
  })

  // ─── Amenities Catalog CRUD ──────────────────────────────────────────
  router.get('/api/admin/amenities/catalog', [auth.authenticate('super_admin')], async () => {
    const data = await orm.findMany('AmenitiesCatalog', {}) as any[]
    return { status: 200, body: { data, total: data.length } }
  })

  router.post('/api/admin/amenities/catalog', [auth.authenticate('super_admin')], async (req: any) => {
    const body = req.body as any
    if (!body.key || !body.label) return { status: 400, body: { error: 'key y label requeridos' } }
    const existing = (await orm.findMany('AmenitiesCatalog', { key: body.key } as any))[0] as any
    if (existing) return { status: 409, body: { error: 'Amenity ya existe' } }
    const item = await orm.create('AmenitiesCatalog', {
      id: crypto.randomUUID(), key: body.key, label: body.label,
      category: body.category || 'interior', icon: body.icon || '',
      isActive: body.isActive !== false ? 1 : 0, sortOrder: body.sortOrder || 0,
    })
    return { status: 201, body: item }
  })

  router.put('/api/admin/amenities/catalog/:id', [auth.authenticate('super_admin')], async (req: any) => {
    const body = req.body as any
    const existing = await orm.findById('AmenitiesCatalog', req.params.id) as any
    if (!existing) return { status: 404, body: { error: 'Amenity no encontrado' } }
    const patch: Record<string, any> = {}
    for (const k of ['key', 'label', 'category', 'icon', 'isActive', 'sortOrder']) {
      if (body[k] !== undefined) patch[k] = k === 'isActive' ? (body[k] ? 1 : 0) : body[k]
    }
    await orm.update('AmenitiesCatalog', req.params.id, patch)
    return { status: 200, body: await orm.findById('AmenitiesCatalog', req.params.id) }
  })

  router.delete('/api/admin/amenities/catalog/:id', [auth.authenticate('super_admin')], async (req: any) => {
    const existing = await orm.findById('AmenitiesCatalog', req.params.id) as any
    if (!existing) return { status: 404, body: { error: 'Amenity no encontrado' } }
    await orm.delete('AmenitiesCatalog', req.params.id)
    return { status: 200, body: { success: true } }
  })
}
