// La app declara cuánto duró el video; el backend lo comprueba contra el archivo
// que quedó en el bucket. Con la subida cortada, la evidencia no se registra.
import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter } from 'arckode-framework'
import { VideoUseCase } from '../usecases/video'
import type { HousekeepingDTO, HousekeepingUser } from '../types'
import type { HousekeepingSettingsUseCase } from '../usecases/settings'
import type { S3StorageAdapter } from '../../../infrastructure/storage/s3-adapter'
import { makeMp4, fakeS3 } from './helpers/mp4'

const settingsStub = { get: async () => ({ maxVideoSeconds: 30 }) } as unknown as HousekeepingSettingsUseCase

const task = { id: 't1', hotelId: 'h1', staffId: 'u1' } as unknown as HousekeepingDTO
const camarera: HousekeepingUser = { id: 'u1', role: 'housekeeper', hotelId: 'h1' }

function makeRepo(): { repo: RepositoryAdapter<HousekeepingDTO>; saved: Record<string, any>[] } {
  const saved: Record<string, any>[] = []
  const repo = {
    findById: async () => task,
    update: async (_id: string, patch: Record<string, any>) => {
      saved.push(patch)
      return { ...task, ...patch }
    },
  } as unknown as RepositoryAdapter<HousekeepingDTO>
  return { repo, saved }
}

/** S3 que responde una ficha técnica fija, como si el archivo ya estuviera arriba. */
function s3With(probe: Record<string, unknown> | null): S3StorageAdapter {
  return {
    statSize: async () => (probe ? (probe.sizeBytes as number) : null),
    // El probe real parsea bytes; acá se cortocircuita con un mp4 mínimo válido
    // construido a medida en `mp4-probe.test.ts`. Este stub cubre el camino de
    // "el objeto no existe" y el de "existe con tal duración".
    readRange: async () => null,
  } as unknown as S3StorageAdapter
}

const input = {
  url: 'https://bucket/x.mp4',
  path: 'housekeeping/t1/video/evidence.mp4',
  durationSeconds: 15,
  mimeType: 'video/mp4',
}

describe('VideoUseCase.attachVideo — verificación contra el bucket', () => {
  it('si el objeto no llegó al bucket, la evidencia NO se registra', async () => {
    const { repo, saved } = makeRepo()
    const uc = new VideoUseCase(repo, settingsStub, s3With(null))
    await expect(uc.attachVideo('t1', input, camarera)).rejects.toThrow('no se completó')
    expect(saved).toHaveLength(0)
  })

  it('un archivo presente pero sin índice legible se trata como subida cortada', async () => {
    const { repo, saved } = makeRepo()
    // statSize responde, readRange no devuelve boxes → probeMp4 da null.
    const uc = new VideoUseCase(repo, settingsStub, s3With({ sizeBytes: 3_180_965 }))
    await expect(uc.attachVideo('t1', input, camarera)).rejects.toThrow('no se completó')
    expect(saved).toHaveLength(0)
  })

  it('sin almacenamiento S3 no se puede verificar nada → no se acepta', async () => {
    const { repo } = makeRepo()
    const uc = new VideoUseCase(repo, settingsStub, undefined)
    await expect(uc.attachVideo('t1', input, camarera)).rejects.toThrow('almacenamiento S3')
  })

  // #392: no adjuntar como evidencia el video de OTRA tarea que ya exista en el bucket.
  it('rechaza un path que no corresponde a esta tarea', async () => {
    const { repo, saved } = makeRepo()
    const uc = new VideoUseCase(repo, settingsStub, s3With({ sizeBytes: 100, durationSeconds: 15 }))
    await expect(
      uc.attachVideo('t1', { ...input, path: 'housekeeping/OTRA-TAREA/video/robado.mp4' }, camarera),
    ).rejects.toThrow('no corresponde a esta tarea')
    expect(saved).toHaveLength(0)
  })

  it('rechaza lo que no es un video antes de tocar el bucket', async () => {
    const { repo } = makeRepo()
    const uc = new VideoUseCase(repo, settingsStub, s3With({ sizeBytes: 100 }))
    await expect(
      uc.attachVideo('t1', { ...input, mimeType: 'image/jpeg' }, camarera),
    ).rejects.toThrow('Solo se permiten videos')
  })

  // El caso real de producción: la app declara 15 s y el archivo dura 0.6 s.
  it('rechaza la grabación cortada y dice cuánto se grabó de verdad', async () => {
    const { repo, saved } = makeRepo()
    const uc = new VideoUseCase(repo, settingsStub, fakeS3(makeMp4({ seconds: 0.6 })))
    await expect(uc.attachVideo('t1', input, camarera)).rejects.toThrow(/incompleto.*0\.6 s.*15 s/s)
    expect(saved).toHaveLength(0)
  })

  it('acepta el video completo y guarda la duración del ARCHIVO, no la declarada', async () => {
    const { repo, saved } = makeRepo()
    const uc = new VideoUseCase(repo, settingsStub, fakeS3(makeMp4({ seconds: 15.04 })))
    await uc.attachVideo('t1', input, camarera)
    expect(saved).toHaveLength(1)
    expect(saved[0]!.video.durationSeconds).toBe(15)
    expect(saved[0]!.video.codec).toBe('avc1')
    expect(saved[0]!.video.playableInBrowser).toBe(true)
  })

  it('el video 4K en HEVC se guarda igual, marcado como no reproducible', async () => {
    const { repo, saved } = makeRepo()
    const hevc = makeMp4({ seconds: 15, codec: 'hvc1', width: 3840, height: 2160 })
    const uc = new VideoUseCase(repo, settingsStub, fakeS3(hevc))
    await uc.attachVideo('t1', input, camarera)
    expect(saved[0]!.video.playableInBrowser).toBe(false)
    expect(saved[0]!.video.height).toBe(2160)
  })

  it('tolera el desvío de redondeo del último cuadro', async () => {
    const { repo, saved } = makeRepo()
    const uc = new VideoUseCase(repo, settingsStub, fakeS3(makeMp4({ seconds: 13.5 })))
    await uc.attachVideo('t1', input, camarera) // declara 15, el archivo trae 13.5
    expect(saved).toHaveLength(1)
  })
})
