// Una llave maestra abre TODAS las puertas: los casos que importan no son los
// felices, son los parciales. Que se aplique en 2 de 3 cerraduras y el sistema
// diga "listo" deja a alguien sin poder entrar; que se revoque en la base pero
// no en el hardware deja una puerta abriéndose con un PIN que figura anulado.
import { describe, it, expect } from 'bun:test'
import { MasterKeysUseCase, type MasterKeyHardware } from '../usecases/master-keys'

const LOCKS = [
  { id: 'l1', name: 'Puerta 101', roomId: 'r1', hotelId: 'h1' },
  { id: 'l2', name: 'Puerta 102', roomId: 'r2', hotelId: 'h1' },
  { id: 'l3', name: 'Lobby', roomId: null, hotelId: 'h1' },
]

/** Simula el hardware: se le dice en qué cerraduras tiene que fallar. */
function setup(opts: { failOn?: string[]; records?: Record<string, any[]>; recordsThrowOn?: string[] } = {}) {
  const rows: any[] = []
  /** Lo que está realmente grabado en cada cerradura física. */
  const hardware: { lockId: string; code: string }[] = []
  const fail = new Set(opts.failOn ?? [])
  const records = opts.records ?? {}
  const throwOn = new Set(opts.recordsThrowOn ?? [])

  const lockDevicesRepo = {
    findMany: async () => LOCKS,
    findById: async (id: string) => LOCKS.find(l => l.id === id) ?? null,
  }
  const lockCodesRepo = {
    create: async (row: any) => { rows.push(row); return row },
    findMany: async (f: any) => rows.filter(r =>
      (!f.masterKeyId || r.masterKeyId === f.masterKeyId) &&
      (!f.codeType || r.codeType === f.codeType)),
    update: async (id: string, patch: any) => {
      const r = rows.find(x => x.id === id)
      if (r) Object.assign(r, patch)
      return r
    },
  }
  const hw: MasterKeyHardware = {
    async createPermanentCode(_h, lockId, code) {
      if (fail.has(lockId)) throw new Error('cerradura fuera de línea')
      hardware.push({ lockId, code: code! })
      return { code: code!, keyboardPwdId: `pwd-${lockId}` }
    },
    async removePasscode(_h, lockId) {
      if (fail.has(lockId)) throw new Error('sin gateway')
      const i = hardware.findIndex(x => x.lockId === lockId)
      if (i >= 0) hardware.splice(i, 1)
    },
    async getRecords(_h, lockId) {
      if (throwOn.has(lockId)) throw new Error('timeout')
      return records[lockId] ?? []
    },
  }
  return {
    uc: new MasterKeysUseCase(lockDevicesRepo, lockCodesRepo, hw),
    rows, hardware,
    failLater: (ids: string[]) => ids.forEach(i => fail.add(i)),
    setRecords: (r: Record<string, any[]>) => Object.assign(records, r),
  }
}

describe('MasterKeysUseCase.create', () => {
  it('aplica el MISMO PIN en todas las cerraduras', async () => {
    const { uc, rows, hardware } = setup()
    const res = await uc.create('h1', { userId: 'u1', label: 'Maestra · Rosa' }, 'admin1')

    expect(res.applied).toHaveLength(3)
    expect(res.failed).toHaveLength(0)
    expect(rows).toHaveLength(3)
    // Un PIN distinto por puerta no sería una llave maestra.
    expect(new Set(hardware.map(h => h.code)).size).toBe(1)
    expect(hardware[0]!.code).toBe(res.code)
    expect(rows.every(r => r.masterKeyId === res.masterKeyId)).toBe(true)
    expect(rows.every(r => r.codeType === 'master' && r.userId === 'u1')).toBe(true)
  })

  it('respeta un PIN elegido a mano', async () => {
    const { uc } = setup()
    const res = await uc.create('h1', { userId: 'u1', code: '4471' }, 'admin1')
    expect(res.code).toBe('4471')
  })

  it('rechaza un PIN que la cerradura no acepta', async () => {
    const { uc } = setup()
    await expect(uc.create('h1', { userId: 'u1', code: '12' }, 'a')).rejects.toThrow('4 y 9 dígitos')
    await expect(uc.create('h1', { userId: 'u1', code: 'abcd' }, 'a')).rejects.toThrow('4 y 9 dígitos')
  })

  it('si una cerradura falla, lo dice en vez de dar la llave por buena', async () => {
    const { uc, rows } = setup({ failOn: ['l2'] })
    const res = await uc.create('h1', { userId: 'u1' }, 'admin1')

    expect(res.applied.map(a => a.lockId)).toEqual(['l1', 'l3'])
    expect(res.failed).toHaveLength(1)
    expect(res.failed[0]).toMatchObject({ lockName: 'Puerta 102' })
    expect(res.failed[0]!.reason).toContain('fuera de línea')
    // Solo se registran las puertas donde el PIN realmente quedó.
    expect(rows).toHaveLength(2)
  })

  it('si no entra en ninguna, no se guarda una llave que no abre nada', async () => {
    const { uc, rows } = setup({ failOn: ['l1', 'l2', 'l3'] })
    await expect(uc.create('h1', { userId: 'u1' }, 'a')).rejects.toThrow('ninguna cerradura')
    expect(rows).toHaveLength(0)
  })
})

describe('MasterKeysUseCase.list', () => {
  it('marca "parcial" la llave que no llegó a todas las puertas', async () => {
    const { uc } = setup({ failOn: ['l2'] })
    await uc.create('h1', { userId: 'u1' }, 'a')
    const [k] = await uc.list('h1')
    expect(k!.status).toBe('partial')
    expect(k!.locksApplied).toBe(2)
    expect(k!.locksTotal).toBe(3)
  })

  it('la llave completa figura activa', async () => {
    const { uc } = setup()
    await uc.create('h1', { userId: 'u1' }, 'a')
    const [k] = await uc.list('h1')
    expect(k!.status).toBe('active')
    expect(k!.locksApplied).toBe(3)
  })
})

describe('MasterKeysUseCase.revoke', () => {
  it('borra el PIN del hardware, no solo de la base', async () => {
    const { uc, hardware } = setup()
    const res = await uc.create('h1', { userId: 'u1' }, 'a')
    expect(hardware).toHaveLength(3)

    const out = await uc.revoke('h1', res.masterKeyId, 'a')
    expect(out.revoked).toBe(3)
    expect(out.failed).toHaveLength(0)
    expect(hardware).toHaveLength(0) // ya no abre ninguna puerta
    const [k] = await uc.list('h1')
    expect(k!.status).toBe('revoked')
  })

  it('si una puerta no se pudo borrar, se avisa: ahí el PIN sigue vivo', async () => {
    const { uc, hardware, failLater } = setup()
    const res = await uc.create('h1', { userId: 'u1' }, 'a')
    failLater(['l2']) // la l2 se cae recién al revocar
    const out = await uc.revoke('h1', res.masterKeyId, 'a')

    expect(out.revoked).toBe(2)
    expect(out.failed).toEqual([{ lockName: 'Puerta 102', reason: 'sin gateway' }])
    expect(hardware.map(h => h.lockId)).toEqual(['l2'])
  })
})

describe('MasterKeysUseCase.accessLog', () => {
  it('dice por dónde entró esa persona, y descarta las aperturas de otros códigos', async () => {
    const { uc, setRecords } = setup()
    const res = await uc.create('h1', { userId: 'u1', code: '445566' }, 'a')
    setRecords({
      l1: [
        { keyboardPwd: '445566', lockDate: 1_700_000_200_000, success: 1 },
        { keyboardPwd: '999999', lockDate: 1_700_000_300_000, success: 1 }, // otro código
      ],
      l3: [{ keyboardPwd: '445566', lockDate: 1_700_000_900_000, success: 1 }],
    })

    const log = await uc.accessLog('h1', res.masterKeyId)
    expect(log).toHaveLength(2)
    expect(log[0]!.lockName).toBe('Lobby')      // el más reciente primero
    expect(log[1]!.lockName).toBe('Puerta 101')
    expect(log[1]!.roomId).toBe('r1')
  })

  it('registra también el intento fallido', async () => {
    const { uc, setRecords } = setup()
    const res = await uc.create('h1', { userId: 'u1', code: '445566' }, 'a')
    setRecords({ l1: [{ keyboardPwd: '445566', lockDate: 1_700_000_200_000, success: 0 }] })
    const log = await uc.accessLog('h1', res.masterKeyId)
    expect(log[0]!.success).toBe(false)
  })

  it('una cerradura sin conexión no tumba el historial de las demás', async () => {
    const { uc, setRecords } = setup({ recordsThrowOn: ['l1'] })
    const res = await uc.create('h1', { userId: 'u1', code: '445566' }, 'a')
    setRecords({ l3: [{ keyboardPwd: '445566', lockDate: 1_700_000_900_000, success: 1 }] })

    const log = await uc.accessLog('h1', res.masterKeyId)
    expect(log).toHaveLength(1)
    expect(log[0]!.lockName).toBe('Lobby')
  })
})

