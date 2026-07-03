// hoteles/service.ts — Facade pública del módulo
// Responsabilidad ÚNICA: casos de uso del módulo.
// NO sabe de HTTP. NO importa de otros módulos.
// Recibe dependencias por constructor (Dependency Inversion).
//
// Si este archivo supera 200 líneas → extraer casos de uso a ./usecases/{caso}.ts
// y dejar acá solo el orquestador que delega.
//
// IMPORTANTE: depende de RepositoryAdapter<HotelesDTO>, no del ORM directamente.
// Esto permite swapear SQL → MongoDB → Prisma en composition-root.ts sin tocar este archivo.

import type { RepositoryAdapter, Logger, CacheAdapter, Auth } from 'arckode-framework'
import { NotFoundError, AuthError } from 'arckode-framework'
import type { HotelesDTO, CreateHotelesDTO, UpdateHotelesDTO, HotelesQuery, HotelesPaginated } from './types'
import type { HotelesSockets } from './sockets'
import type { SettingsFullUseCase } from './usecases/settings-full'

function safeParse(v: any) { if (typeof v !== 'string') return v; try { return JSON.parse(v) } catch { return v } }

export class HotelesService {
  private sockets: HotelesSockets = {}

  constructor(
    private readonly repo: RepositoryAdapter<HotelesDTO>,
    private readonly logger: Logger,
    private readonly cache: CacheAdapter,
    private readonly auth: Auth,
    private readonly orm?: any,
    private readonly settingsFull?: SettingsFullUseCase,
  ) {}

  // ACUMULA handlers — nunca pisa el anterior.
  // Si dos conectores registran el mismo evento, ambos corren en cadena (secuencial).
  // Para ejecución paralela independiente → usar EventBus en composition-root.ts.
  setSockets(s: Partial<HotelesSockets>): void {
    const next = s as Record<string, any>
    const cur = this.sockets as Record<string, any>
    for (const key of Object.keys(next)) {
      const h = next[key]
      if (!h) continue
      const prev = cur[key]
      cur[key] = prev ? async (...a: any[]) => { await prev(...a); await h(...a) } : h
    }
  }

  async list(query: HotelesQuery, currentUser: { id: string; role: string; hotelId?: string }): Promise<HotelesPaginated> {
    const filters: Record<string, unknown> = {}
    if (query.status) filters.status = query.status

    // Multi-tenancy: non-super_admin only sees their hotel
    if (currentUser.role !== 'super_admin') {
      if (!currentUser.hotelId) throw new AuthError('No hotel assigned')
      filters.id = currentUser.hotelId
    }

    const page = Math.max(query.page || 1, 1)
    const limit = Math.min(Math.max(query.limit || 20, 1), 100)
    const offset = (page - 1) * limit

    // When searching, fetch all matching then paginate in memory
    if (query.search) {
      const all = await this.repo.findMany(filters)
      const q = query.search.toLowerCase()
      const filtered = all.filter((r: any) =>
        r.name?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q)
      )
      const paged = filtered.slice(offset, offset + limit)
      const safe = paged.map(({ wifiPassword, ownerTaxId, ...rest }) => rest as HotelesDTO)
      return { data: safe, total: filtered.length, page, limit, pages: Math.ceil(filtered.length / limit) }
    }

    const result = await this.repo.paginate(filters, { offset, limit })
    const safe = result.data.map(({ wifiPassword, ownerTaxId, ...rest }) => rest as HotelesDTO)

    return { data: safe, total: result.total, page, limit, pages: Math.ceil(result.total / limit) }
  }

  async getById(id: string, currentUser: { id: string; role: string; hotelId?: string }): Promise<HotelesDTO> {
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundError('Hotel no encontrado')

    // Ownership check
    if (currentUser.role !== 'super_admin' && item.id !== currentUser.hotelId) {
      throw new AuthError('No autorizado')
    }

    // Filter sensitive fields
    const { wifiPassword, ownerTaxId, ...safe } = item as any
    return safe
  }

  async create(dto: CreateHotelesDTO): Promise<HotelesDTO> {
    this.logger.info('Creando hotel', { name: dto.name })
    const item = await this.repo.create(dto as any)
    const { wifiPassword, ownerTaxId, ...safe } = item as any
    await this.sockets.onHotelesCreated?.(safe)
    await this.cache.delete('hoteles:list')
    return safe
  }

  async update(id: string, dto: UpdateHotelesDTO, currentUser: { id: string; role: string; hotelId?: string }): Promise<HotelesDTO> {
    // Ownership check
    if (currentUser.role !== 'super_admin') {
      const existing = await this.repo.findById(id)
      if (!existing) throw new NotFoundError('Hotel no encontrado')
      if (existing.id !== currentUser.hotelId) throw new AuthError('No autorizado')
    }

    const item = await this.repo.update(id, dto as any)
    if (!item) throw new NotFoundError('Hotel no encontrado')
    const { wifiPassword, ownerTaxId, ...safe } = item as any
    await this.sockets.onHotelesUpdated?.(safe)
    await this.cache.delete('hoteles:list')
    return safe
  }

  async delete(id: string, currentUser: { id: string; role: string; hotelId?: string }): Promise<void> {
    // Only super_admin can delete hotels
    if (currentUser.role !== 'super_admin') {
      throw new AuthError('Solo super_admin puede eliminar hoteles')
    }

    const deleted = await this.repo.delete(id)
    if (!deleted) throw new NotFoundError('Hotel no encontrado')
    await this.sockets.onHotelesDeleted?.(id)
    await this.cache.delete('hoteles:list')
  }

  // ── Settings (cross-module reads via orm) ─────────────────────────────
  async getSettings(hotelId: string, user?: any): Promise<any> {
    if (!this.orm) throw new Error('ORM no disponible para settings')
    const hotel = await this.orm.findById('Hotels', hotelId)
    if (user) this.auth.assertOwnership(hotel, user)
    const rooms = await this.orm.findMany('Rooms', { hotelId }) as any[]
    const seen = new Set<string>(); const baseRates: any[] = []
    for (const r of rooms) { if (!seen.has(r.type)) { seen.add(r.type); baseRates.push({ type: r.type, price: r.basePrice }) } }
    return { hotel, baseRates }
  }

  async updateHotel(id: string, body: Record<string, any>, user?: any): Promise<any> {
    if (!this.orm) throw new Error('ORM no disponible para settings')
    const existing = await this.orm.findById('Hotels', id)
    if (!existing) throw new NotFoundError('Hotel no encontrado')
    if (user) this.auth.assertOwnership(existing, user)
    const safePatch: Record<string, any> = {}
    const allowed = ['name', 'country', 'address', 'phone', 'email', 'timezone', 'currency', 'checkIn', 'checkOut', 'plan', 'freeCancellation', 'depositRequired', 'depositPercent', 'weekendSurcharge', 'ownerName', 'ownerTaxId', 'deviceEmail', 'accommodationType', 'registrationNumber', 'website', 'bookingEngineUrl', 'phone2', 'warningPhone', 'secondaryCurrency', 'youtubeUrl', 'starRating', 'onlineBookingStatus', 'motorVersion', 'latitude', 'longitude', 'province', 'municipality', 'locality', 'postalCode', 'cleaningType', 'depositType', 'depositFixed', 'advanceType', 'advanceAmount', 'releaseHours', 'defaultPaymentMethod', 'requestReviews', 'publishReviewScore', 'publishReviewComments', 'taxName', 'taxRate', 'descriptionJson', 'wifiNetwork', 'wifiPassword']
    for (const k of allowed) { if (body[k] !== undefined) safePatch[k] = body[k] }
    await this.orm.update('Hotels', id, safePatch)
    return await this.orm.findById('Hotels', id)
  }

  async getSettingsFull(hotelId: string, user?: any): Promise<any> {
    if (!this.settingsFull) throw new Error('SettingsFull no disponible')
    return this.settingsFull.execute(hotelId, this.auth, user)
  }

  async getConfig(hotelId: string, key: string): Promise<any> {
    if (!this.orm) throw new Error('ORM no disponible')
    const row = (await this.orm.findMany('Configuration', { hotelId, key }))[0] as any
      || (await this.orm.findMany('Configuration', { hotelId: 'platform', key }))[0] as any
    return { valor: row ? safeParse(row.value) : null }
  }

  async setConfig(body: { clave: string; valor: any; hotelId?: string }): Promise<any> {
    if (!this.orm) throw new Error('ORM no disponible')
    const { clave, valor, hotelId } = body
    if (!clave || valor === undefined) throw new Error('clave y valor requeridos')
    const existing = (await this.orm.findMany('Configuration', { hotelId: hotelId || 'platform', key: clave }))[0] as any
    const val = typeof valor === 'object' ? JSON.stringify(valor) : String(valor)
    if (existing) await this.orm.update('Configuration', existing.id, { value: val })
    else await this.orm.create('Configuration', { id: crypto.randomUUID(), hotelId: hotelId || 'platform', key: clave, value: val })
    return { success: true }
  }
}
