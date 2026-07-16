import type { RepositoryAdapter, Logger } from 'arckode-framework'
import type { LockDeviceDTO, LockCodeDTO } from './types'
import { getAccessToken, listLocks, addKeyboardPassword, deleteKeyboardPassword, randomPin, listGateways, listLockPasscodes } from '../../services/ttlock-client'
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

  async listCodes(hotelId: string): Promise<any[]> {
    return this.queries.listCodesByHotel(hotelId)
  }

  /** Gateways de la cuenta TTLock del hotel (lo que muestra el tab "Gateways"). */
  async listGateways(hotelId: string): Promise<any[]> {
    const cfg = await this.queries.getTtlockConfig(hotelId)
    if (!cfg?.accessToken) throw new Error('TTLock no conectado')
    return listGateways({ clientId: cfg.clientId, accessToken: cfg.accessToken, region: cfg.region })
  }

  /**
   * Códigos REALES vivos en una cerradura física (tab "Comprobar códigos activos"), leídos del
   * hardware vía la API — no de la tabla `lock_codes`. `lockDeviceId` es el id de nuestra tabla:
   * validamos ownership antes de resolver el ttlockLockId y consultar.
   */
  async listActiveCodes(hotelId: string, lockDeviceId: string): Promise<any[]> {
    const lock = await this.lockDevicesRepo.findById(lockDeviceId) as any
    if (!lock) throw new Error('Cerradura no encontrada')
    if (this.auth) this.auth.assertOwnership(lock.hotelId, hotelId, undefined, 'super_admin')
    if (!lock.ttlockLockId) throw new Error('Cerradura sin ID TTLock')
    const cfg = await this.queries.getTtlockConfig(hotelId)
    if (!cfg?.accessToken) throw new Error('TTLock no conectado')
    return listLockPasscodes({ clientId: cfg.clientId, accessToken: cfg.accessToken, region: cfg.region }, Number(lock.ttlockLockId))
  }

  /**
   * Genera el código solo si la reserva no tiene ya uno ACTIVO. Es el punto de entrada de la
   * generación automática (al pagarse la seña): `generateCode` siempre inserta, así que el reintento
   * del webhook de Stripe o varios Links de Pago para la misma reserva duplicarían PINs. El botón
   * manual ("Regenerar") sigue usando `generateCode` directo, porque ahí regenerar es intencional.
   */
  async generateCodeIfAbsent(hotelId: string, reservationId: string): Promise<any> {
    const codes = await this.queries.listCodesByHotel(hotelId)
    // 'pending' cuenta como existente: es el código emitido cuando la cerradura estaba offline.
    // Sin esto, cada reintento del webhook duplicaría la fila pendiente para la misma reserva.
    const existing = codes.find((c: any) => c.reservationId === reservationId && (c.status === 'active' || c.status === 'pending'))
    if (existing) return { skipped: true, reason: `already-${existing.status}` }
    return this.generateCode(hotelId, reservationId)
  }

  /**
   * Borra el PIN de la cerradura FÍSICA. Si TTLock falla, propagamos: marcar el código como
   * revocado en la base mientras la puerta sigue abriéndose con ese PIN es peor que fallar fuerte.
   */
  private async removePinFromLock(code: any): Promise<void> {
    if (!code?.ttlockKeyboardPwdId || !code?.hotelId) return
    const lock = await this.lockDevicesRepo.findById(code.lockId) as any
    if (this.auth && lock) this.auth.assertOwnership(lock.hotelId, code.hotelId, undefined, 'super_admin')
    if (!lock?.ttlockLockId) return
    const cfg = await this.queries.getTtlockConfig(code.hotelId)
    if (!cfg?.accessToken) throw new Error('TTLock no conectado: no se pudo borrar el PIN de la cerradura')
    await deleteKeyboardPassword(
      { clientId: cfg.clientId, accessToken: cfg.accessToken, region: cfg.region, addType: cfg.addType },
      Number(lock.ttlockLockId),
      String(code.ttlockKeyboardPwdId),
    )
  }

  async revokeCode(codeId: string, hotelId?: string): Promise<void> {
    const code = await this.lockCodesRepo.findById(codeId) as any
    if (!code) throw new Error('Código no encontrado')
    if (this.auth) this.auth.assertOwnership(code.hotelId, hotelId, undefined, 'super_admin')
    await this.removePinFromLock(code)
    await this.lockCodesRepo.update(codeId, { status: 'revoked' })
  }

  async expireCodesByReservation(reservationId: string): Promise<void> {
    const codes = await this.lockCodesRepo.findMany({ reservationId }) as any[]
    for (const c of codes) {
      // 'pending' (emitido con la cerradura offline) también se cierra al checkout: sin
      // ttlockKeyboardPwdId `removePinFromLock` es no-op, así que no toca hardware, pero la
      // fila deja de figurar como vigente.
      if (c.status !== 'active' && c.status !== 'pending') continue
      // El checkout no puede fallar porque una cerradura no responda: logueamos y seguimos,
      // pero el código igual queda marcado como expirado para que no se muestre como vigente.
      try {
        await this.removePinFromLock(c)
      } catch (e: any) {
        this.logger.error(`No se pudo borrar el PIN ${c.id} de la cerradura: ${e?.message || e}`)
      }
      await this.lockCodesRepo.update(c.id, { status: 'expired' })
    }
  }

  async updateLock(lockId: string, body: any, hotelId?: string): Promise<any> {
    // Ownership ANTES de escribir — sino el write cross-tenant se persiste aunque
    // después tire ForbiddenError (orden roto).
    const lock = await this.lockDevicesRepo.findById(lockId) as any
    if (this.auth && lock) this.auth.assertOwnership(lock.hotelId, hotelId, undefined, 'super_admin')
    const patch: Partial<Omit<LockDeviceDTO, 'id'>> = {}
    if (body.roomId !== undefined) patch.roomId = body.roomId
    if (body.name !== undefined) patch.name = body.name
    await this.lockDevicesRepo.update(lockId, patch)
    return await this.lockDevicesRepo.findById(lockId)
  }
}
