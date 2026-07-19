// master-keys.ts — Llave maestra: un PIN por PERSONA que abre todas las puertas.
//
// El código de un huésped pertenece a una reserva y a una sola cerradura. Una
// llave maestra es al revés: pertenece a alguien del hotel y tiene que vivir en
// TODAS las cerraduras al mismo tiempo, con el mismo número, para que esa
// persona use siempre el mismo PIN.
//
// Dos cosas que no son negociables acá:
//
//  - Aplicar el PIN en N cerraduras son N llamadas al hardware, y algunas pueden
//    fallar (cerradura sin gateway, sin batería, fuera de línea). Se informa en
//    cuántas quedó y en cuáles no, en vez de decir "listo" y dejar puertas que
//    esa persona no puede abrir.
//  - Es una llave que abre todo: revocar tiene que borrarla del hardware, no
//    solo marcarla en la base. Un registro que dice "revocada" mientras la
//    puerta sigue abriendo es peor que no tener el registro.
import { ValidationError, NotFoundError } from 'arckode-framework'

/**
 * Lo único que esta funcionalidad necesita del hardware. Se inyecta en vez de
 * importarse directo: así se prueba el comportamiento —qué pasa si una puerta
 * falla, si se revoca a medias— sin hablar con cerraduras reales.
 */
export interface MasterKeyHardware {
  createPermanentCode(hotelId: string, lockDeviceId: string, code?: string, name?: string): Promise<{ code: string; keyboardPwdId?: string }>
  removePasscode(hotelId: string, lockDeviceId: string, keyboardPwdId: string): Promise<void>
  getRecords(hotelId: string, lockDeviceId: string, days?: number): Promise<any[]>
}

/** Cuántos días de historial se leen por defecto al pedir "dónde entró". */
const DEFAULT_LOG_DAYS = 30

/** TTLock acepta PIN de 4 a 9 dígitos. */
const PIN_RE = /^\d{4,9}$/

export interface CreateMasterKeyInput {
  /** Persona dueña de la llave (`users.id`). */
  userId: string
  /** PIN elegido a mano; si no viene, se genera. */
  code?: string
  /** Nombre visible del código en la cerradura. */
  label?: string
}

export interface MasterKeyApplyResult {
  masterKeyId: string
  code: string
  /** Cerraduras donde el PIN quedó funcionando. */
  applied: { lockId: string; lockName: string }[]
  /** Cerraduras donde NO se pudo aplicar, con el motivo. */
  failed: { lockId: string; lockName: string; reason: string }[]
}

export interface MasterKeySummary {
  masterKeyId: string
  userId: string
  label: string
  code: string
  status: 'active' | 'revoked' | 'partial'
  /** En cuántas cerraduras está aplicada, sobre el total del hotel. */
  locksApplied: number
  locksTotal: number
  createdAt?: string
}

/** Una apertura registrada por el hardware, ya resuelta a nombre de puerta. */
export interface AccessEntry {
  lockId: string
  lockName: string
  roomId?: string
  /** ISO. */
  at: string
  success: boolean
}

export class MasterKeysUseCase {
  constructor(
    private readonly lockDevicesRepo: any,
    private readonly lockCodesRepo: any,
    private readonly hw: MasterKeyHardware,
  ) {}

  /**
   * Crea la llave y la aplica en todas las cerraduras del hotel.
   *
   * El PIN se genera UNA vez y se manda igual a cada cerradura: si se dejara que
   * el hardware lo genere, la persona terminaría con un número distinto por
   * puerta, que es justo lo contrario de una llave maestra.
   */
  async create(hotelId: string, input: CreateMasterKeyInput, actorId: string): Promise<MasterKeyApplyResult> {
    if (!input.userId) throw new ValidationError('Falta la persona a la que pertenece la llave')
    if (input.code && !PIN_RE.test(input.code)) {
      throw new ValidationError('El PIN debe tener entre 4 y 9 dígitos')
    }

    const locks = await this.lockDevicesRepo.findMany({ hotelId }) as any[]
    if (!locks.length) throw new ValidationError('El hotel no tiene cerraduras registradas')

    const code = input.code ?? randomPin()
    const label = input.label?.trim() || 'Llave maestra'
    const masterKeyId = crypto.randomUUID()

    const applied: MasterKeyApplyResult['applied'] = []
    const failed: MasterKeyApplyResult['failed'] = []

    for (const lock of locks) {
      const lockName = lock.name || lock.id
      try {
        const r = await this.hw.createPermanentCode(hotelId, lock.id, code, label)
        await this.lockCodesRepo.create({
          id: crypto.randomUUID(),
          lockId: lock.id,
          hotelId,
          code,
          codeType: 'master',
          status: 'active',
          ttlockKeyboardPwdId: r.keyboardPwdId ? String(r.keyboardPwdId) : '',
          userId: input.userId,
          masterKeyId,
          label,
          sentVia: `master:${actorId}`,
        })
        applied.push({ lockId: lock.id, lockName })
      } catch (err) {
        failed.push({ lockId: lock.id, lockName, reason: messageOf(err) })
      }
    }

    if (!applied.length) {
      throw new ValidationError(
        `No se pudo aplicar la llave en ninguna cerradura: ${failed.map(f => `${f.lockName} (${f.reason})`).join(', ')}`,
      )
    }
    return { masterKeyId, code, applied, failed }
  }

  /**
   * Qué puertas abre esta llave y cuáles no. Es lo que hace falta para
   * administrarla: una cerradura pudo fallar al crearla, o simplemente no se
   * quiere dar acceso a todas (la bodega, la caja fuerte).
   */
  async locksOf(hotelId: string, masterKeyId: string): Promise<{ lockId: string; lockName: string; roomId?: string; applied: boolean }[]> {
    const rows = await this.rowsOf(hotelId, masterKeyId)
    const activeByLock = new Map(rows.filter(r => r.status === 'active').map(r => [r.lockId, r]))
    const locks = await this.lockDevicesRepo.findMany({ hotelId }) as any[]
    return locks.map(l => ({
      lockId: l.id,
      lockName: l.name || l.id,
      roomId: l.roomId || undefined,
      applied: activeByLock.has(l.id),
    }))
  }

  /**
   * Suma una puerta a una llave que ya existe, con el MISMO PIN.
   *
   * Sirve para la cerradura que falló al crearla (estaba sin batería, sin
   * gateway) y para dar acceso nuevo sin obligar a la persona a memorizar otro
   * número.
   */
  async addLock(hotelId: string, masterKeyId: string, lockId: string): Promise<void> {
    const rows = await this.rowsOf(hotelId, masterKeyId)
    if (rows.some(r => r.lockId === lockId && r.status === 'active')) return // ya abre esa puerta

    const lock = await this.lockDevicesRepo.findById(lockId)
    if (!lock || lock.hotelId !== hotelId) throw new NotFoundError('Cerradura no encontrada')

    const first = rows[0]!
    const r = await this.hw.createPermanentCode(hotelId, lockId, first.code, first.label ?? 'Llave maestra')

    // Si la llave ya estuvo en esta puerta y se quitó, se reusa la fila en vez
    // de acumular una nueva por cada alta y baja.
    const previous = rows.find(r2 => r2.lockId === lockId)
    const patch = { status: 'active', ttlockKeyboardPwdId: r.keyboardPwdId ? String(r.keyboardPwdId) : '' }
    if (previous) await this.lockCodesRepo.update(previous.id, patch)
    else {
      await this.lockCodesRepo.create({
        id: crypto.randomUUID(),
        lockId, hotelId,
        code: first.code,
        codeType: 'master',
        userId: first.userId,
        masterKeyId,
        label: first.label,
        sentVia: first.sentVia,
        ...patch,
      })
    }
  }

  /** Le quita UNA puerta a la llave, borrando el PIN de esa cerradura. */
  async removeLock(hotelId: string, masterKeyId: string, lockId: string): Promise<void> {
    const rows = await this.rowsOf(hotelId, masterKeyId)
    const row = rows.find(r => r.lockId === lockId && r.status === 'active')
    if (!row) return // no la abría: nada que quitar

    if (row.ttlockKeyboardPwdId) {
      await this.hw.removePasscode(hotelId, lockId, row.ttlockKeyboardPwdId)
    }
    await this.lockCodesRepo.update(row.id, { status: 'revoked' })
  }

  /** Llaves maestras del hotel, con en cuántas puertas quedó cada una. */
  async list(hotelId: string): Promise<MasterKeySummary[]> {
    const rows = await this.lockCodesRepo.findMany({ hotelId, codeType: 'master' }) as any[]
    const locksTotal = ((await this.lockDevicesRepo.findMany({ hotelId })) as any[]).length

    const byKey = new Map<string, any[]>()
    for (const r of rows) {
      if (!r.masterKeyId) continue
      const list = byKey.get(r.masterKeyId) ?? []
      list.push(r)
      byKey.set(r.masterKeyId, list)
    }

    return [...byKey.entries()].map(([masterKeyId, list]) => {
      const active = list.filter(r => r.status === 'active')
      const first = list[0]
      return {
        masterKeyId,
        userId: first.userId ?? '',
        label: first.label ?? 'Llave maestra',
        code: first.code,
        // "parcial" cuando la llave está viva pero no llegó a todas las puertas:
        // el gerente tiene que saberlo, no descubrirlo cuando alguien no puede entrar.
        status: active.length === 0 ? 'revoked' : active.length < locksTotal ? 'partial' : 'active',
        locksApplied: active.length,
        locksTotal,
        createdAt: first.createdAt,
      }
    })
  }

  /**
   * Borra la llave de TODAS las cerraduras. Si alguna falla, se dice: esa puerta
   * sigue abriéndose con ese PIN y hay que resolverlo a mano.
   */
  async revoke(hotelId: string, masterKeyId: string, _actorId: string): Promise<{ revoked: number; failed: { lockName: string; reason: string }[] }> {
    const rows = await this.rowsOf(hotelId, masterKeyId)
    const failed: { lockName: string; reason: string }[] = []
    let revoked = 0

    for (const row of rows) {
      if (row.status !== 'active') continue
      const lock = await this.lockDevicesRepo.findById(row.lockId)
      const lockName = lock?.name || row.lockId
      try {
        if (row.ttlockKeyboardPwdId) {
          await this.hw.removePasscode(hotelId, row.lockId, row.ttlockKeyboardPwdId)
        }
        await this.lockCodesRepo.update(row.id, { status: 'revoked' })
        revoked++
      } catch (err) {
        failed.push({ lockName, reason: messageOf(err) })
      }
    }
    return { revoked, failed }
  }

  /**
   * Dónde entró esa persona con su llave.
   *
   * El hardware guarda el historial por cerradura, así que se pregunta a cada
   * una y se deja solo lo abierto con ESTE PIN. Es la única forma de responder
   * "¿por dónde anduvo?" — TTLock no ofrece una vista por código.
   */
  async accessLog(hotelId: string, masterKeyId: string, days = DEFAULT_LOG_DAYS): Promise<AccessEntry[]> {
    const rows = await this.rowsOf(hotelId, masterKeyId)
    const code = rows[0]!.code
    const entries: AccessEntry[] = []

    for (const row of rows) {
      const lock = await this.lockDevicesRepo.findById(row.lockId)
      const lockName = lock?.name || row.lockId
      let records: any[] = []
      try {
        records = await this.hw.getRecords(hotelId, row.lockId, days)
      } catch {
        continue // una cerradura sin conexión no puede tumbar el historial entero
      }
      for (const rec of records) {
        if (String(rec.keyboardPwd ?? '') !== String(code)) continue
        entries.push({
          lockId: row.lockId,
          lockName,
          roomId: lock?.roomId,
          at: new Date(Number(rec.lockDate ?? 0)).toISOString(),
          success: rec.success === undefined ? true : Number(rec.success) === 1,
        })
      }
    }
    return entries.sort((a, b) => b.at.localeCompare(a.at))
  }

  private async rowsOf(hotelId: string, masterKeyId: string): Promise<any[]> {
    const rows = await this.lockCodesRepo.findMany({ hotelId, masterKeyId }) as any[]
    if (!rows.length) throw new NotFoundError('Llave maestra no encontrada')
    return rows
  }
}

/** PIN de 6 dígitos, que es el largo con el que la gente ya está acostumbrada. */
const PIN_MIN = 100_000
const PIN_MAX = 999_999

function randomPin(): string {
  return String(Math.floor(PIN_MIN + Math.random() * (PIN_MAX - PIN_MIN + 1)))
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
