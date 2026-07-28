// hotelmedia/service.ts — Facade del módulo hotel_media. Orquesta; la lógica que crece
// vive en usecases/media-crud.ts. Depende de RepositoryAdapter<HotelMediaDTO>, NO del
// ORM directo. NO importa de otros módulos (cross-module va por conectores).
//
// Las rooms se acceden vía su repo ORM (`Rooms`, registrado por HabitacionesModule) —
// no es import de módulo, mismo patrón que restaurant con `Hotels`/`Users`.
import type { RepositoryAdapter, Logger, Auth } from 'arckode-framework'
import type { StorageService } from 'arckode-framework/modules/storage'
import type { HotelMediaDTO, CreateHotelMediaDTO, UpdateHotelMediaDTO, MediaType, CurrentUser } from './types'
import * as mediaCrud from './usecases/media-crud'

export class HotelMediaService {
  constructor(
    private readonly media: RepositoryAdapter<HotelMediaDTO>,
    private readonly rooms: RepositoryAdapter<any>,
    private readonly userRepo: RepositoryAdapter<any>,
    private readonly logger: Logger,
    private readonly auth: Auth,
    /** Opcional: si no se inyecta, `upload` con data-URL fallará con ValidationError claro. */
    private readonly storage?: StorageService,
  ) {}

  private deps(): mediaCrud.MediaCrudDeps {
    return {
      media: this.media,
      rooms: this.rooms,
      userRepo: this.userRepo,
      auth: this.auth,
      storage: this.storage,
    }
  }

  /** Lista media del hotel (opcionalmente filtrada por type), ordenada por sortOrder ASC. */
  listByHotel(hotelId: string, type: MediaType | undefined, user: CurrentUser) {
    return mediaCrud.listByHotel(this.deps(), hotelId, type, user)
  }

  /** Crea media. `url` puede ser data-URL base64 (sube a storage) o http(s) (directa). */
  upload(hotelId: string, dto: CreateHotelMediaDTO, user: CurrentUser) {
    this.logger.info('hotel_media: upload', { hotelId, type: dto.type })
    return mediaCrud.upload(this.deps(), hotelId, dto, user)
  }

  /** Actualiza campos editables (alt, sortOrder, type, url, roomId). hotelId NO cambia. */
  update(id: string, dto: UpdateHotelMediaDTO, user: CurrentUser) {
    return mediaCrud.update(this.deps(), id, dto, user)
  }

  /** Borra el registro. Best-effort sin limpieza del storage (ver usecase). */
  remove(id: string, user: CurrentUser) {
    return mediaCrud.remove(this.deps(), id, user)
  }

  /** Reescribe sortOrder 0..N-1 sin gaps según el orden del array `ids`. */
  reorder(hotelId: string, ids: string[], user: CurrentUser) {
    return mediaCrud.reorder(this.deps(), hotelId, ids, user)
  }
}
