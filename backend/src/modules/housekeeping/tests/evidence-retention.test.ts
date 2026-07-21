import { describe, it, expect } from 'bun:test'
import {
  purgeExpiredEvidence, isExpired, evidencePaths, type EvidenceTask,
} from '../usecases/evidence-retention'

const DAY = 86_400_000
const NOW = Date.parse('2026-07-20T12:00:00Z')

function task(over: Partial<EvidenceTask>): EvidenceTask {
  return { id: 't', hotelId: 'h1', completedDate: new Date(NOW - 40 * DAY).toISOString(), ...over }
}

function makeRepo(tasks: EvidenceTask[]) {
  const updates: Array<{ id: string; patch: Record<string, unknown> }> = []
  return {
    repo: {
      findMany: async () => tasks,
      update: async (id: string, patch: Record<string, unknown>) => { updates.push({ id, patch }); return {} },
    },
    updates,
  }
}
function makeStorage(failOn: string[] = []) {
  const deleted: string[] = []
  return {
    storage: { delete: async (p: string) => { if (failOn.includes(p)) throw new Error('boom'); deleted.push(p) } },
    deleted,
  }
}

describe('isExpired', () => {
  it('vence pasados los días de retención', () => {
    expect(isExpired(task({ completedDate: new Date(NOW - 40 * DAY).toISOString() }), 35, NOW)).toBe(true)
    expect(isExpired(task({ completedDate: new Date(NOW - 30 * DAY).toISOString() }), 35, NOW)).toBe(false)
  })
  it('retención 0 = nunca vence', () => {
    expect(isExpired(task({ completedDate: new Date(NOW - 999 * DAY).toISOString() }), 0, NOW)).toBe(false)
  })
  it('sin fecha no vence (no se puede saber la antigüedad)', () => {
    expect(isExpired(task({ completedDate: null, createdAt: null }), 35, NOW)).toBe(false)
  })
  it('usa createdAt si falta completedDate', () => {
    expect(isExpired({ id: 't', completedDate: null, createdAt: new Date(NOW - 40 * DAY).toISOString() }, 35, NOW)).toBe(true)
  })
})

describe('evidencePaths', () => {
  it('junta fotos y video, sin vacíos', () => {
    const t = task({ photos: [{ path: 'a.jpg' }, { path: '' }, {}], video: { path: 'v.mp4' } })
    expect(evidencePaths(t)).toEqual(['a.jpg', 'v.mp4'])
  })
  it('sin evidencia → []', () => {
    expect(evidencePaths(task({ photos: [], video: null }))).toEqual([])
  })
})

describe('purgeExpiredEvidence', () => {
  it('borra los archivos vencidos y vacía los campos, dejando la tarea', async () => {
    const { repo, updates } = makeRepo([task({ id: 't1', photos: [{ path: 'a.jpg' }], video: { path: 'v.mp4' } })])
    const { storage, deleted } = makeStorage()
    const r = await purgeExpiredEvidence(repo, storage, 'h1', 35, NOW)
    expect(deleted).toEqual(['a.jpg', 'v.mp4'])
    expect(r).toEqual({ tasksPurged: 1, filesDeleted: 2 })
    expect(updates).toEqual([{ id: 't1', patch: { photos: [], video: null } }])
  })

  it('NO toca las que aún no vencieron', async () => {
    const { repo, updates } = makeRepo([task({ completedDate: new Date(NOW - 10 * DAY).toISOString(), photos: [{ path: 'a.jpg' }] })])
    const { storage, deleted } = makeStorage()
    const r = await purgeExpiredEvidence(repo, storage, 'h1', 35, NOW)
    expect(deleted).toEqual([])
    expect(r.tasksPurged).toBe(0)
    expect(updates).toEqual([])
  })

  it('retención 0 = no purga nada', async () => {
    const { repo } = makeRepo([task({ photos: [{ path: 'a.jpg' }] })])
    const { storage, deleted } = makeStorage()
    const r = await purgeExpiredEvidence(repo, storage, 'h1', 0, NOW)
    expect(deleted).toEqual([])
    expect(r.tasksPurged).toBe(0)
  })

  it('si un archivo no se puede borrar, NO vacía el campo (se reintenta después)', async () => {
    const { repo, updates } = makeRepo([task({ id: 't1', photos: [{ path: 'ok.jpg' }], video: { path: 'falla.mp4' } })])
    const { storage } = makeStorage(['falla.mp4'])
    const r = await purgeExpiredEvidence(repo, storage, 'h1', 35, NOW)
    expect(r.tasksPurged).toBe(0)        // no se declara purgada
    expect(updates).toEqual([])          // el campo NO se vació
  })

  it('ignora tareas vencidas pero sin evidencia', async () => {
    const { repo, updates } = makeRepo([task({ photos: [], video: null })])
    const { storage } = makeStorage()
    const r = await purgeExpiredEvidence(repo, storage, 'h1', 35, NOW)
    expect(r.tasksPurged).toBe(0)
    expect(updates).toEqual([])
  })
})
