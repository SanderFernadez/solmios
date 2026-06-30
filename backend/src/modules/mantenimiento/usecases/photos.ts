// mantenimiento/usecases/photos.ts — Upload de fotos antes/después
import type { RepositoryAdapter, Logger } from 'arckode-framework'
import { NotFoundError, ValidationError } from 'arckode-framework'
import type { StorageService, FileUpload } from 'arckode-framework/modules/storage'
import type { MantenimientoDTO } from '../types'
import { assertOwnership } from '../helpers'

const MAX_PHOTOS = 20
const ALLOWED_IMAGE_PREFIX = 'image/'

export class PhotosUseCase {
  constructor(
    private readonly repo: RepositoryAdapter<MantenimientoDTO>,
    private readonly logger: Logger,
    private readonly invalidate: (hotelId?: string) => Promise<void>,
    private readonly storage?: StorageService,
  ) {}

  async add(id: string, file: FileUpload, type: string, currentUser: { id: string; role: string; hotelId?: string }): Promise<MantenimientoDTO> {
    if (!this.storage) throw new Error('StorageService no configurado')
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Ticket de mantenimiento no encontrado')
    assertOwnership(existing.hotelId, currentUser)
    if (!file.mimeType?.startsWith(ALLOWED_IMAGE_PREFIX)) {
      throw new ValidationError('Solo se permiten imágenes')
    }
    if ((existing.photos ?? []).length >= MAX_PHOTOS) {
      throw new ValidationError(`Límite de ${MAX_PHOTOS} fotos alcanzado`)
    }
    const stored = await this.storage.upload(file, 'maintenance')
    const photos = [...(existing.photos ?? []), {
      url: stored.url,
      path: stored.path,
      type,
      uploadedBy: currentUser.id,
      uploadedAt: new Date().toISOString(),
    }]
    const item = await this.repo.update(id, { photos } as any)
    if (!item) throw new NotFoundError('Ticket de mantenimiento no encontrado')
    await this.invalidate(existing.hotelId)
    return item
  }
}
