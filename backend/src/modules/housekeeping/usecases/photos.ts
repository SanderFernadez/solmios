// usecases/photos.ts — Evidencia fotográfica de limpieza (upload/remove).
import type { RepositoryAdapter, Logger } from 'arckode-framework'
import { NotFoundError, AuthError, ValidationError } from 'arckode-framework'
import type { StorageService, FileUpload } from 'arckode-framework/modules/storage'
import type { HousekeepingDTO, HousekeepingUser } from '../types'

/** Máximo de fotos de evidencia por tarea (evita que el JSON photos[] crezca sin tope). */
const MAX_PHOTOS_PER_TASK = 20
/** Las fotos de evidencia deben ser imágenes (rechaza binarios disfrazados en el data URL). */
const ALLOWED_IMAGE_PREFIX = 'image/'

export class PhotosUseCase {
  constructor(
    private readonly repo: RepositoryAdapter<HousekeepingDTO>,
    private readonly logger: Logger,
    private readonly invalidate: (hotelId?: string) => Promise<void>,
    private readonly storage?: StorageService,
  ) {}

  async addPhoto(id: string, file: FileUpload, currentUser: HousekeepingUser): Promise<HousekeepingDTO> {
    if (!this.storage) throw new Error('StorageService no configurado para housekeeping')
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Tarea de housekeeping no encontrada')
    if (currentUser.role !== 'super_admin' && existing.hotelId !== currentUser.hotelId) throw new AuthError('No autorizado')
    // A4 — Whitelist de imágenes: el mimeType del FileUpload debe ser image/* (el data URL
    // base64 puede mentir, así que se valida acá antes de persistir).
    if (!file.mimeType?.startsWith(ALLOWED_IMAGE_PREFIX)) {
      throw new ValidationError('Solo se permiten imágenes como evidencia')
    }
    // A3 — Límite de fotos por tarea para que el JSON no crezca sin tope.
    if ((existing.photos ?? []).length >= MAX_PHOTOS_PER_TASK) {
      throw new ValidationError(`Límite de ${MAX_PHOTOS_PER_TASK} fotos por tarea alcanzado`)
    }
    const stored = await this.storage.upload(file, 'housekeeping')
    const photos = [...(existing.photos ?? []), {
      url: stored.url,
      path: stored.path,
      name: stored.originalName,
      size: stored.size,
      mimeType: stored.mimeType,
      uploadedAt: new Date().toISOString(),
    }]
    const item = await this.repo.update(id, { photos } as any)
    if (!item) throw new NotFoundError('Tarea de housekeeping no encontrada')
    await this.invalidate(existing.hotelId)
    return item
  }

  async removePhoto(id: string, photoUrl: string, currentUser: HousekeepingUser): Promise<HousekeepingDTO> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Tarea de housekeeping no encontrada')
    if (currentUser.role !== 'super_admin' && existing.hotelId !== currentUser.hotelId) throw new AuthError('No autorizado')
    const removed = (existing.photos ?? []).find(p => p.url === photoUrl)
    const photos = (existing.photos ?? []).filter(p => p.url !== photoUrl)
    // best-effort: borrar el archivo del disco (no bloquea si falla)
    if (removed && this.storage) {
      await this.storage.delete(removed.path).catch((e: unknown) =>
        this.logger.warn('No se pudo eliminar archivo de storage', { photoUrl, error: (e as Error).message }),
      )
    }
    const item = await this.repo.update(id, { photos } as any)
    if (!item) throw new NotFoundError('Tarea de housekeeping no encontrada')
    await this.invalidate(existing.hotelId)
    return item
  }
}
