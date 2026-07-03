import { NotFoundError } from 'arckode-framework'

function safeParse(v: any) { if (typeof v !== 'string') return v; try { return JSON.parse(v) } catch { return v } }

export class SettingsFullUseCase {
  constructor(private readonly orm: any) {}

  async execute(hotelId: string, auth?: { assertOwnership?: (hotel: any, user: any) => void }, user?: any): Promise<any> {
    const hotel = await this.orm.findById('Hotels', hotelId)
    if (!hotel) throw new NotFoundError('Hotel no encontrado')
    if (user && auth?.assertOwnership) auth.assertOwnership(hotel, user)
    const [amenities, seasons, rates, blocks] = await Promise.all([
      this.orm.findMany('HotelAmenities', { hotelId, isActive: 1 }) as Promise<any[]>,
      this.orm.findMany('Seasons', { hotelId }) as Promise<any[]>,
      this.orm.findMany('RoomRates', { hotelId }) as Promise<any[]>,
      this.orm.findMany('RoomBlocks', { hotelId }) as Promise<any[]>,
    ])
    const rooms = await this.orm.findMany('Rooms', { hotelId }) as any[]
    const roomTypes = [...new Set(rooms.map((r: any) => r.type || 'standard'))]
    const ttlockCfg = (await this.orm.findMany('Configuration', { hotelId, key: 'ttlock_config' }))[0] as any
    const ttlock = ttlockCfg ? safeParse(ttlockCfg.value) : {}
    return { hotel, amenities: amenities.map((a: any) => a.amenityKey), seasons: seasons.sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0)), rates, blocks, roomTypes, ttlock: { ...ttlock, configured: !!(ttlock?.clientId && ttlock?.clientSecret) } }
  }
}
