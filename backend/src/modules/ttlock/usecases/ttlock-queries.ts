function safeParse(v: any) { if (typeof v !== 'string') return v; try { return JSON.parse(v) } catch { return v } }

export class TtlockQueries {
  constructor(private readonly orm: any) {}

  async getConfig(hotelId: string): Promise<any> {
    const cfg = (await this.orm.findMany('Configuration', { hotelId, key: 'ttlock_config' }))[0] as any
    const parsed = cfg ? safeParse(cfg.value) : {}
    return {
      clientId: parsed?.clientId || '', username: parsed?.username || '',
      region: parsed?.region || 'eu', accountId: parsed?.accountId || '',
      configured: !!(parsed?.clientId && parsed?.clientSecret), connected: !!parsed?.accessToken,
    }
  }

  async updateConfig(hotelId: string, body: any): Promise<void> {
    const cfg = await this.orm.findMany('Configuration', { hotelId, key: 'ttlock_config' }) as any[]
    const prev = cfg[0] ? safeParse(cfg[0].value) : {}
    const keep = (k: string): string => (body[k] === undefined || body[k] === '') ? (prev[k] ?? '') : body[k]
    const value = JSON.stringify({
      clientId: keep('clientId'), clientSecret: keep('clientSecret'),
      username: keep('username'), password: keep('password'),
      region: body.region ?? prev.region ?? 'eu',
      accountId: body.accountId ?? prev.accountId ?? '',
      accessToken: keep('accessToken'), refreshToken: keep('refreshToken'),
    })
    if (cfg.length > 0) await this.orm.update('Configuration', cfg[0].id, { value })
    else await this.orm.create('Configuration', { id: crypto.randomUUID(), hotelId, key: 'ttlock_config', value })
  }

  async connectConfig(hotelId: string, body: any, getAccessToken: Function): Promise<void> {
    const cfg = await this.orm.findMany('Configuration', { hotelId, key: 'ttlock_config' }) as any[]
    const prev = cfg[0] ? safeParse(cfg[0].value) : {}
    const creds = {
      clientId: body.clientId || prev.clientId, clientSecret: body.clientSecret || prev.clientSecret,
      username: body.username || prev.username, password: body.password || prev.password,
      region: body.region || prev.region || 'eu',
    }
    const tokens = await getAccessToken(creds)
    const value = JSON.stringify({ ...prev, ...creds, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken || prev.refreshToken })
    if (cfg.length > 0) await this.orm.update('Configuration', cfg[0].id, { value })
    else await this.orm.create('Configuration', { id: crypto.randomUUID(), hotelId, key: 'ttlock_config', value })
  }

  async getRoomsByHotel(hotelId: string): Promise<any[]> {
    return this.orm.findMany('Rooms', { hotelId }) as any[]
  }

  async getTtlockConfig(hotelId: string): Promise<any> {
    const cfg = (await this.orm.findMany('Configuration', { hotelId, key: 'ttlock_config' }))[0] as any
    return cfg ? safeParse(cfg.value) : {}
  }

  async findReservationById(reservationId: string): Promise<any> {
    return (await this.orm.findMany('Reservations', { id: reservationId }))[0] || null
  }
}
