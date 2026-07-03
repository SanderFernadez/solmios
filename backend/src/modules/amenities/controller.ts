import type { HttpRequest, Logger } from 'arckode-framework'
import type { AmenitiesService } from './service'

export class AmenitiesController {
  constructor(
    private readonly service: AmenitiesService,
    private readonly logger: Logger,
  ) {}

  private async hotelOf(req: any): Promise<string | undefined> {
    const q = req?.query || {}
    if (q.hotelId) return q.hotelId as string
    const userHotel = req?.user?.hotelId
    if (userHotel && userHotel !== 'platform') return userHotel as string
    if (req?.user?.id && req?.user?.role !== 'super_admin') {
      const uRows = await (this.service as any).orm?.findMany?.('Users', { id: req.user.id }) || []
      const u: any = uRows?.[0]
      if (u?.hotelId) return u.hotelId
    }
    return undefined
  }

  async getCatalog() {
    return { status: 200, body: this.service.getStaticCatalog() }
  }

  async listHotel(req: HttpRequest) {
    const id = await this.hotelOf(req)
    return { status: 200, body: { data: id ? await this.service.listHotelAmenities(id) : [] } }
  }

  async updateHotel(req: HttpRequest) {
    const id = await this.hotelOf(req); if (!id) return { status: 400, body: { error: 'hotelId requerido' } }
    const { amenities } = req.body as any
    if (!Array.isArray(amenities)) return { status: 400, body: { error: 'amenities debe ser un array' } }
    return { status: 200, body: { success: true, count: await this.service.updateHotelAmenities(id, amenities) } }
  }

  async listRoom(req: HttpRequest) {
    return { status: 200, body: { data: await this.service.listRoomAmenities(req.params.roomId) } }
  }

  async updateRoom(req: HttpRequest) {
    const { amenities } = req.body as any
    if (!Array.isArray(amenities)) return { status: 400, body: { error: 'amenities debe ser un array' } }
    return { status: 200, body: { success: true, count: await this.service.updateRoomAmenities(req.params.roomId, amenities) } }
  }
}
