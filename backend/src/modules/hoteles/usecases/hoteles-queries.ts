import { NotFoundError } from 'arckode-framework'

function safeParse(v: any) { if (typeof v !== 'string') return v; try { return JSON.parse(v) } catch { return v } }

export class HotelesQueries {
  constructor(private readonly orm: any) {}

  async getSettings(hotelId: string, auth?: any, user?: any): Promise<any> {
    const hotel = await this.orm.findById('Hotels', hotelId)
    if (user && auth) auth.assertOwnership(hotel?.id ?? hotelId, user.hotelId, user.role, 'super_admin')
    const rooms = await this.orm.findMany('Rooms', { hotelId }) as any[]
    const seen = new Set<string>(); const baseRates: any[] = []
    for (const r of rooms) { if (!seen.has(r.type)) { seen.add(r.type); baseRates.push({ type: r.type, price: r.basePrice }) } }
    return { hotel, baseRates }
  }

  async updateHotel(id: string, body: Record<string, any>, auth?: any, user?: any): Promise<any> {
    const existing = await this.orm.findById('Hotels', id)
    if (!existing) throw new NotFoundError('Hotel no encontrado')
    if (user && auth) auth.assertOwnership(existing.id, user.hotelId, user.role, 'super_admin')
    const safePatch: Record<string, any> = {}
    const allowed = ['name', 'country', 'address', 'phone', 'email', 'timezone', 'currency', 'checkIn', 'checkOut', 'plan', 'freeCancellation', 'depositRequired', 'depositPercent', 'weekendSurcharge', 'ownerName', 'ownerTaxId', 'deviceEmail', 'accommodationType', 'registrationNumber', 'website', 'bookingEngineUrl', 'phone2', 'warningPhone', 'secondaryCurrency', 'youtubeUrl', 'starRating', 'onlineBookingStatus', 'motorVersion', 'latitude', 'longitude', 'province', 'municipality', 'locality', 'postalCode', 'cleaningType', 'depositType', 'depositFixed', 'advanceType', 'advanceAmount', 'releaseHours', 'defaultPaymentMethod', 'requestReviews', 'publishReviewScore', 'publishReviewComments', 'taxName', 'taxRate', 'descriptionJson', 'wifiNetwork', 'wifiPassword']
    for (const k of allowed) { if (body[k] !== undefined) safePatch[k] = body[k] }
    await this.orm.update('Hotels', id, safePatch)
    return await this.orm.findById('Hotels', id)
  }

  async getConfig(hotelId: string, key: string): Promise<any> {
    const row = (await this.orm.findMany('Configuration', { hotelId, key }))[0] as any
      || (await this.orm.findMany('Configuration', { hotelId: 'platform', key }))[0] as any
    return { valor: row ? safeParse(row.value) : null }
  }

  async setConfig(body: { clave: string; valor: any; hotelId?: string }): Promise<any> {
    const { clave, valor, hotelId } = body
    if (!clave || valor === undefined) throw new Error('clave y valor requeridos')
    const existing = (await this.orm.findMany('Configuration', { hotelId: hotelId || 'platform', key: clave }))[0] as any
    const val = typeof valor === 'object' ? JSON.stringify(valor) : String(valor)
    if (existing) await this.orm.update('Configuration', existing.id, { value: val })
    else await this.orm.create('Configuration', { id: crypto.randomUUID(), hotelId: hotelId || 'platform', key: clave, value: val })
    return { success: true }
  }

  async resolveHotelId(user: any): Promise<string | undefined> {
    if (user?.hotelId && user?.hotelId !== 'platform') return user.hotelId
    if (user?.id && user?.role !== 'super_admin') {
      const rows = await this.orm.findMany('Users', { id: user.id })
      const u: any = rows?.[0]
      if (u?.hotelId) return u.hotelId
    }
    return ((await this.orm.findMany('Hotels', {}))[0] as any)?.id
  }
}
