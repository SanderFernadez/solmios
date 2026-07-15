// video.ts — Evidencia de fin en VIDEO (modo `video` de los settings del hotel).
//
// Los bytes NO pasan por el backend. Las fotos viajan como base64 dentro del JSON
// con tope de 10 MB de body; un video de 30 s pesa mucho más y no entra ni cerca.
// Acá el backend solo FIRMA un permiso temporal (URL prefirmada) y la app hace el
// `PUT` directo contra el bucket; después confirma la url y la duración.
//
// Por eso el modo video EXIGE almacenamiento S3 (Backblaze). Con el adapter local
// no hay a quién prefirmar: se responde un error claro en vez de fallar raro.
import type { RepositoryAdapter } from 'arckode-framework'
import { NotFoundError, AuthError, ValidationError } from 'arckode-framework'
import type { HousekeepingDTO, VideoEvidence, HousekeepingUser } from '../types'
import type { S3StorageAdapter } from '../../../infrastructure/storage/s3-adapter'
import type { HousekeepingSettingsUseCase } from './settings'

/** Solo se aceptan videos. Un `image/*` acá sería un error de la app. */
const VIDEO_MIME_PREFIX = 'video/'

/** Cuánto vive la URL prefirmada. Alcanza de sobra para subir el archivo. */
const UPLOAD_URL_TTL_SECONDS = 900

export interface VideoUploadTicket {
  /** URL contra la que la app hace PUT con los bytes del video. */
  uploadUrl: string
  /** URL pública definitiva, la que se guarda en la tarea al confirmar. */
  publicUrl: string
  /** Clave del objeto en el bucket. */
  path: string
  expiresInSeconds: number
}

export class VideoUseCase {
  constructor(
    private readonly repo: RepositoryAdapter<HousekeepingDTO>,
    private readonly settings: HousekeepingSettingsUseCase,
    /** Ausente si el hotel corre con storage local: el modo video no funciona. */
    private readonly s3?: S3StorageAdapter,
  ) {}

  /** La tarea, comprobando que sea del hotel de quien pide. */
  private async ownedTask(taskId: string, user: HousekeepingUser): Promise<HousekeepingDTO> {
    const task = await this.repo.findById(taskId)
    if (!task) throw new NotFoundError('Tarea no encontrada')
    const taskHotelId = (task as any).hotelId
    if (user.role !== 'super_admin' && taskHotelId !== user.hotelId) {
      throw new AuthError('La tarea no pertenece a tu hotel')
    }
    return task
  }

  private assertVideoStorage(): S3StorageAdapter {
    if (!this.s3) {
      throw new ValidationError(
        'El modo video necesita almacenamiento S3 (Backblaze) configurado en el servidor',
      )
    }
    return this.s3
  }

  /**
   * Firma un permiso temporal para que la app suba el video directo al bucket.
   * Valida la duración ANTES de firmar: no tiene sentido dejar subir 3 minutos
   * para rechazarlos después de que viajaron.
   */
  async requestUploadUrl(
    taskId: string,
    input: { contentType: string; durationSeconds: number },
    user: HousekeepingUser,
  ): Promise<VideoUploadTicket> {
    const s3 = this.assertVideoStorage()
    const task = await this.ownedTask(taskId, user)

    if (!input.contentType.startsWith(VIDEO_MIME_PREFIX)) {
      throw new ValidationError('Solo se permiten videos como evidencia de fin')
    }

    const { maxVideoSeconds } = await this.settings.get((task as any).hotelId)
    this.assertDuration(input.durationSeconds, maxVideoSeconds)

    const ext = input.contentType.split('/')[1]?.split(';')[0] || 'mp4'
    const path = s3.keyFor(`housekeeping/${taskId}/video`, `evidence.${ext}`)

    return {
      uploadUrl: s3.presignPut(path, {
        contentType: input.contentType,
        expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
      }),
      publicUrl: s3.getUrl(path),
      path,
      expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
    }
  }

  /** La app confirma: los bytes ya están en el bucket, se cuelgan de la tarea. */
  async attachVideo(
    taskId: string,
    input: { url: string; path: string; durationSeconds: number; mimeType: string },
    user: HousekeepingUser,
  ): Promise<HousekeepingDTO> {
    const task = await this.ownedTask(taskId, user)

    if (!input.mimeType.startsWith(VIDEO_MIME_PREFIX)) {
      throw new ValidationError('Solo se permiten videos como evidencia de fin')
    }

    const { maxVideoSeconds } = await this.settings.get((task as any).hotelId)
    this.assertDuration(input.durationSeconds, maxVideoSeconds)

    const video: VideoEvidence = {
      url: input.url,
      path: input.path,
      durationSeconds: Math.trunc(input.durationSeconds),
      mimeType: input.mimeType,
      uploadedAt: new Date().toISOString(),
    }

    const updated = await this.repo.update(taskId, { video } as any)
    if (!updated) throw new NotFoundError('Error al actualizar tarea')
    return updated
  }

  /** Borra el video de la tarea (la camarera lo rehace). */
  async removeVideo(taskId: string, user: HousekeepingUser): Promise<HousekeepingDTO> {
    const task = await this.ownedTask(taskId, user)
    const current = (task as any).video as VideoEvidence | null | undefined

    const updated = await this.repo.update(taskId, { video: null } as any)
    if (!updated) throw new NotFoundError('Error al actualizar tarea')

    // Best-effort: si el borrado en el bucket falla, la tarea ya quedó sin video
    // y la camarera puede regrabar. No se le rompe el request por un huérfano.
    if (current?.path && this.s3) await this.s3.delete(current.path).catch(() => {})
    return updated
  }

  /**
   * URL firmada temporal para VER el video de la tarea. La app la pide justo
   * antes de reproducir; expira sola. Requiere S3 (el modo video ya lo exige) y
   * que la tarea sea del hotel de quien pide. Devuelve también la duración para
   * que el visor sepa cuánto dura sin volver a leer la tarea.
   */
  async getViewUrl(
    taskId: string,
    user: HousekeepingUser,
  ): Promise<{ url: string; durationSeconds: number; expiresInSeconds: number }> {
    const s3 = this.assertVideoStorage()
    const task = await this.ownedTask(taskId, user)
    const video = (task as any).video as VideoEvidence | null | undefined
    if (!video?.path) throw new NotFoundError('La tarea no tiene un video de evidencia')

    return {
      url: s3.presignGet(video.path, { expiresInSeconds: UPLOAD_URL_TTL_SECONDS }),
      durationSeconds: video.durationSeconds,
      expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
    }
  }

  private assertDuration(seconds: number, max: number): void {
    const n = Math.trunc(Number(seconds))
    if (!Number.isFinite(n) || n <= 0) {
      throw new ValidationError('La duración del video es inválida')
    }
    if (n > max) {
      throw new ValidationError(`El video no puede durar más de ${max} segundos`)
    }
  }
}
