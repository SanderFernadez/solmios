import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter } from 'arckode-framework'
import { VideoUseCase } from '../usecases/video'
import type { HousekeepingDTO, HousekeepingUser } from '../types'
import type { HousekeepingSettingsUseCase } from '../usecases/settings'
import type { S3StorageAdapter } from '../../../infrastructure/storage/s3-adapter'

// getViewUrl firma una URL temporal para VER el video. No lee settings ni firma
// nada de subida, así que alcanza con un settings stub y un S3 que solo firma GET.
const settingsStub = {} as unknown as HousekeepingSettingsUseCase

function makeRepo(task: HousekeepingDTO | null): RepositoryAdapter<HousekeepingDTO> {
  return { findById: async () => task } as unknown as RepositoryAdapter<HousekeepingDTO>
}

function fakeS3(): S3StorageAdapter {
  return {
    presignGet: (path: string, opts?: { expiresInSeconds?: number }) =>
      `signed://${path}?exp=${opts?.expiresInSeconds ?? 0}`,
  } as unknown as S3StorageAdapter
}

const camarera: HousekeepingUser = { id: 'u1', role: 'housekeeper', hotelId: 'h1' }
const taskWithVideo = {
  id: 't1', hotelId: 'h1',
  video: { url: 'https://bucket/x.mp4', path: 'housekeeping/t1/video/evidence.mp4', durationSeconds: 28, mimeType: 'video/mp4', uploadedAt: '2026-01-01T00:00:00Z' },
} as unknown as HousekeepingDTO

describe('VideoUseCase.getViewUrl', () => {
  it('firma una URL temporal del path del video y devuelve la duración', async () => {
    const uc = new VideoUseCase(makeRepo(taskWithVideo), settingsStub, fakeS3())
    const res = await uc.getViewUrl('t1', camarera)
    expect(res.url).toBe('signed://housekeeping/t1/video/evidence.mp4?exp=900')
    expect(res.durationSeconds).toBe(28)
    expect(res.expiresInSeconds).toBe(900)
  })

  it('sin almacenamiento S3 no hay nada que firmar → error claro', async () => {
    const uc = new VideoUseCase(makeRepo(taskWithVideo), settingsStub, undefined)
    await expect(uc.getViewUrl('t1', camarera)).rejects.toThrow('almacenamiento S3')
  })

  it('una tarea de otro hotel no se puede ver', async () => {
    const uc = new VideoUseCase(makeRepo(taskWithVideo), settingsStub, fakeS3())
    const otroHotel: HousekeepingUser = { id: 'u2', role: 'housekeeper', hotelId: 'h2' }
    await expect(uc.getViewUrl('t1', otroHotel)).rejects.toThrow('no pertenece a tu hotel')
  })

  it('una tarea sin video devuelve 404, no una URL firmada de la nada', async () => {
    const noVideo = { id: 't1', hotelId: 'h1', video: null } as unknown as HousekeepingDTO
    const uc = new VideoUseCase(makeRepo(noVideo), settingsStub, fakeS3())
    await expect(uc.getViewUrl('t1', camarera)).rejects.toThrow('no tiene un video')
  })
})
