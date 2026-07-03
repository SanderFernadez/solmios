export class ReservasQueries {
  constructor(private readonly orm: any) {}

  async findReservationByHash(hash: string): Promise<any> {
    const reservas = await this.orm.findMany('Reservations', {}) as any[]
    return reservas.find((r: any) => String(r.id).replace(/-/g, '').slice(0, 12) === hash || r.id === hash)
  }

  async getCompanions(reservationId: string): Promise<any[]> {
    return this.orm.findMany('Companions', { reservationId }) as any[]
  }

  async createCompanion(data: any): Promise<any> {
    return this.orm.create('Companions', data)
  }

  async getLockCodes(reservationId: string): Promise<any[]> {
    return this.orm.findMany('LockCodes', { reservationId }) as any[]
  }

  async getPaymentRequests(reservationId: string): Promise<any[]> {
    return this.orm.findMany('PaymentRequests', { reservationId }) as any[]
  }

  async getReservationAddons(reservationId: string): Promise<any[]> {
    return this.orm.findMany('ReservationAddons', { reservationId }) as any[]
  }

  async getAuditLogs(entity: string, entityId: string): Promise<any[]> {
    return this.orm.findMany('Auditlog', { entity, entityId }) as any[]
  }

  async createAuditLog(data: any): Promise<void> {
    this.orm.create('Auditlog', data).catch((e: any) => {})
  }

  async updateReservation(id: string, patch: any): Promise<void> {
    await this.orm.update('Reservations', id, patch)
  }

  async updateRoom(roomId: string, patch: any): Promise<void> {
    await this.orm.update('Rooms', roomId, patch)
  }

  async findGuestById(guestId: string): Promise<any> {
    const rows = await this.orm.findMany('Guests', { id: guestId })
    return rows?.[0] || null
  }

  async createGuest(data: any): Promise<any> {
    return this.orm.create('Guests', data)
  }

  async updateGuest(guestId: string, patch: any): Promise<void> {
    await this.orm.update('Guests', guestId, patch)
  }

  async createFolio(data: any): Promise<void> {
    await this.orm.create('Folios', data)
  }

  async findConfiguration(hotelId: string, key: string): Promise<any> {
    return (await this.orm.findMany('Configuration', { hotelId, key }))[0] || null
  }

  async upsertConfiguration(hotelId: string, key: string, value: string): Promise<void> {
    const existing = (await this.orm.findMany('Configuration', { hotelId, key }))[0] as any
    if (existing) await this.orm.update('Configuration', existing.id, { value })
    else await this.orm.create('Configuration', { id: crypto.randomUUID(), hotelId, key, value })
  }

  async findHotels(): Promise<any[]> {
    return this.orm.findMany('Hotels', {})
  }

  async findHotelById(hotelId: string): Promise<any> {
    return (await this.orm.findMany('Hotels', { id: hotelId }))[0] || null
  }

  async findRoomsByHotel(hotelId: string): Promise<any[]> {
    return this.orm.findMany('Rooms', { hotelId }) as any[]
  }

  async findReservationsByHotel(hotelId: string): Promise<any[]> {
    return this.orm.findMany('Reservations', { hotelId }) as any[]
  }

  async findReservationById(id: string): Promise<any> {
    return (await this.orm.findMany('Reservations', { id }))[0] || null
  }
}
