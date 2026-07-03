import type { RepositoryAdapter, Logger } from 'arckode-framework'
import type { LockDeviceDTO, LockCodeDTO } from './types'
import { getAccessToken, listLocks, addKeyboardPassword, randomPin } from '../../services/ttlock-client'
import { generateCodeForReservation } from './usecases/ttlock-config'
import type { TtlockQueries } from './usecases/ttlock-queries'

function safeParse(v: any) { if (typeof v !== 'string') return v; try { return JSON.parse(v) } catch { return v } }

export class TtlockService {
  constructor(
    private readonly lockDevicesRepo: RepositoryAdapter<LockDeviceDTO>,
    private readonly lockCodesRepo: RepositoryAdapter<LockCodeDTO>,
    private readonly logger: Logger,
    private readonly queries: TtlockQueries,
    private readonly auth?: any,
  ) {}

  async getConfig(hotelId: string): Promise<any> {
    return this.queries.getConfig(hotelId)
  }

  async updateConfig(hotelId: string, body: any): Promise<void> {
    return this.queries.updateConfig(hotelId, body)
  }

  async connect(hotelId: string, body: any): Promise<void> {
    return this.queries.connectConfig(hotelId, body, getAccessToken)
  }

  async listLocks(hotelId: string): Promise<any[]> {
    const locks = await this.lockDevicesRepo.findMany({ hotelId })
    const rooms = await this.queries.getRoomsByHotel(hotelId)
    const roomMap = new Map(rooms.map((r: any) => [r.id, r]))
    return locks.map(l => ({ ...l, roomNumber: roomMap.get(l.roomId)?.number || '—' }))
  }

  async syncLocks(hotelId: string): Promise<number> {
    const parsed = await this.queries.getTtlockConfig(hotelId)
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
    return generateCodeForReservation(
      reservationId, hotelId, this.lockDevicesRepo, this.lockCodesRepo,
      getAccessToken, addKeyboardPassword, randomPin,
      (hid: string) => this.queries.getTtlockConfig(hid),
      (id: string) => this.queries.findReservationById(id),
      this.auth,
    )
  }

  async revokeCode(codeId: string): Promise<void> {
    await this.lockCodesRepo.update(codeId, { status: 'revoked' })
  }

  async expireCodesByReservation(reservationId: string): Promise<void> {
    const codes = await this.lockCodesRepo.findMany({ reservationId }) as any[]
    for (const c of codes) {
      if (c.status === 'active') await this.lockCodesRepo.update(c.id, { status: 'expired' })
    }
  }

  async updateLock(lockId: string, body: any, hotelId?: string): Promise<any> {
    const patch: Partial<Omit<LockDeviceDTO, 'id'>> = {}
    if (body.roomId !== undefined) patch.roomId = body.roomId
    if (body.name !== undefined) patch.name = body.name
    await this.lockDevicesRepo.update(lockId, patch)
    const lock = await this.lockDevicesRepo.findById(lockId) as any
    if (this.auth && lock) this.auth.assertOwnership(lock.hotelId, hotelId, undefined, 'super_admin')
    return lock
  }
}
