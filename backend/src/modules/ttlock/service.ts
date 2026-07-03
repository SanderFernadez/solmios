import type { RepositoryAdapter, Logger } from 'arckode-framework'
import type { LockDeviceDTO, LockCodeDTO } from './types'
import { getAccessToken, listLocks, addKeyboardPassword, randomPin } from '../../services/ttlock-client'

export class TtlockService {
  constructor(
    private readonly lockDevicesRepo: RepositoryAdapter<LockDeviceDTO>,
    private readonly lockCodesRepo: RepositoryAdapter<LockCodeDTO>,
    private readonly orm: any,
    private readonly logger: Logger,
    private readonly auth?: any,
  ) {}

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

  async connect(hotelId: string, body: any): Promise<void> {
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

  async listLocks(hotelId: string): Promise<any[]> {
    const locks = await this.lockDevicesRepo.findMany({ hotelId })
    const rooms = await this.orm.findMany('Rooms', { hotelId }) as any[]
    const roomMap = new Map(rooms.map((r: any) => [r.id, r]))
    return locks.map(l => ({ ...l, roomNumber: roomMap.get(l.roomId)?.number || '—' }))
  }

  async syncLocks(hotelId: string): Promise<number> {
    const cfg = (await this.orm.findMany('Configuration', { hotelId, key: 'ttlock_config' }))[0] as any
    const parsed = cfg ? safeParse(cfg.value) : {}
    if (!parsed?.clientId) throw new Error('TTLock no configurado')
    if (!parsed?.accessToken) throw new Error('TTLock no conectado')
    const remoteLocks = await listLocks({ clientId: parsed.clientId, accessToken: parsed.accessToken, region: parsed.region })
    const existing = await this.lockDevicesRepo.findMany({ hotelId })
    const byTtlock = new Map(existing.filter((l: any) => l.ttlockLockId).map((l: any) => [String(l.ttlockLockId), l]))
    let synced = 0
    for (const l of remoteLocks) {
      const ttlockId = String(l.lockId); const name = l.lockAlias || l.lockName || `Cerradura ${ttlockId}`; const mac = l.lockMac || ''; const batteryLevel = Number(l.electricQuantity ?? 0); const status = 'online' as const
      const ex = byTtlock.get(ttlockId)
      if (ex) await this.lockDevicesRepo.update(ex.id, { name, mac, batteryLevel, status })
      else await this.lockDevicesRepo.create({ hotelId, ttlockLockId: ttlockId, roomId: '', name, mac, batteryLevel, status })
      synced++
    }
    return synced
  }

  async generateCode(hotelId: string, reservationId: string): Promise<any> {
    const res = await this.orm.findById('Reservations', reservationId) as any
    if (!res) throw new Error('Reserva no encontrada')
    if (res.hotelId !== hotelId) throw new Error('Sin acceso a esta reserva')
    if (this.auth) this.auth.assertOwnership(res, { hotelId })
    const lock = (await this.lockDevicesRepo.findMany({ roomId: res.roomId }))[0] as any
    if (!lock?.ttlockLockId) throw new Error('La habitación no tiene cerradura TTLock')
    const cfg = (await this.orm.findMany('Configuration', { hotelId, key: 'ttlock_config' }))[0] as any
    const parsed = cfg ? safeParse(cfg.value) : {}
    if (!parsed?.accessToken) throw new Error('TTLock no conectado')
    const creds = { clientId: parsed.clientId, accessToken: parsed.accessToken, region: parsed.region }
    const password = randomPin()
    const startMs = new Date(res.checkIn).getTime(); const endMs = new Date(res.checkOut).getTime()
    let pwdId = ''
    try { const r = await addKeyboardPassword(creds, Number(lock.ttlockLockId), password, startMs, endMs); pwdId = r.keyboardPwdId || '' } catch (e: any) { throw new Error(e.message || 'No se pudo crear el PIN') }
    return await this.lockCodesRepo.create({ lockId: lock.id, reservationId, code: password, codeType: 'time', startDate: String(res.checkIn).slice(0, 10), endDate: String(res.checkOut).slice(0, 10), status: 'active', ttlockKeyboardPwdId: pwdId, sentVia: '' })
  }

  async revokeCode(codeId: string): Promise<void> {
    await this.lockCodesRepo.update(codeId, { status: 'revoked' })
  }

  async updateLock(lockId: string, body: any, hotelId?: string): Promise<any> {
    const patch: Partial<Omit<LockDeviceDTO, 'id'>> = {}
    if (body.roomId !== undefined) patch.roomId = body.roomId
    if (body.name !== undefined) patch.name = body.name
    await this.lockDevicesRepo.update(lockId, patch)
    const lock = await this.lockDevicesRepo.findById(lockId) as any
    if (this.auth && lock) this.auth.assertOwnership(lock, { hotelId })
    return lock
  }
}

function safeParse(v: any) { if (typeof v !== 'string') return v; try { return JSON.parse(v) } catch { return v } }
