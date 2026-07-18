// Con el hotel en modo `video`, la habitación no se marca limpia sin la
// grabación colgada. Antes, si la subida fallaba, la tarea se cerraba igual y
// quedaba una limpieza "verificada" sin ninguna evidencia detrás.
import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter } from 'arckode-framework'
import { TimingsUseCase } from '../usecases/timings'
import type { HousekeepingDTO, HousekeepingUser } from '../types'

const camarera: HousekeepingUser = { id: 'u1', role: 'housekeeper', hotelId: 'h1' }

function setup(task: Partial<HousekeepingDTO>, mode: 'photos' | 'video') {
  const existing = {
    id: 't1', hotelId: 'h1', staffId: 'u1', status: 'in_progress',
    startTime: '2026-07-18T10:00:00Z', ...task,
  } as unknown as HousekeepingDTO
  const updates: Record<string, any>[] = []
  const repo = {
    findById: async () => existing,
    update: async (_id: string, patch: Record<string, any>) => {
      updates.push(patch)
      return { ...existing, ...patch }
    },
  } as unknown as RepositoryAdapter<HousekeepingDTO>
  const uc = new TimingsUseCase(
    repo,
    async () => {},
    async () => {},
    undefined,
    async () => {},
    { get: async () => ({ completionEvidence: mode }) },
  )
  return { uc, updates }
}

describe('TimingsUseCase.complete — evidencia obligatoria', () => {
  it('modo video sin video: la tarea NO se cierra', async () => {
    const { uc, updates } = setup({ video: null }, 'video')
    await expect(uc.complete('t1', camarera)).rejects.toThrow('Falta el video')
    expect(updates).toHaveLength(0)
  })

  it('modo video con el video verificado: cierra normal', async () => {
    const video = { path: 'housekeeping/t1/video/e.mp4', durationSeconds: 15 }
    const { uc, updates } = setup({ video } as any, 'video')
    const res = await uc.complete('t1', camarera)
    expect(res.status).toBe('completed')
    expect(updates).toHaveLength(1)
  })

  it('modo fotos: el video no se exige', async () => {
    const { uc, updates } = setup({ video: null }, 'photos')
    const res = await uc.complete('t1', camarera)
    expect(res.status).toBe('completed')
    expect(updates).toHaveLength(1)
  })
})
