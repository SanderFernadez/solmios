// usecases/photos.ts — Evidencia fotográfica de limpieza (upload/remove).
import type { RepositoryAdapter, Logger } from 'arckode-framework'
import { NotFoundError, AuthError } from 'arckode-framework'
import type { StorageService, FileUpload } from 'arckode-framework/modules/storage'
import type { HousekeepingDTO, HousekeepingUser } from '../types'

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
