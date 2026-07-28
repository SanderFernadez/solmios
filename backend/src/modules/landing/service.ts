// landing/service.ts — Facade del módulo landing_blocks. Orquesta; la lógica que crece
// vive en usecases/blocks-crud.ts. Depende de RepositoryAdapter<LandingBlockDTO>, NO
// del ORM directo. NO importa de otros módulos (cross-module va por conectores).
//
// Los `hotels` se acceden vía su repo ORM (`Hotels`, registrado por HotelesModule) —
// no es import de módulo, mismo patrón que hotel-media/restaurant con `Hotels`/`Users`.
//
// `transactor` es una interface de este módulo (`LandingTransactor`) que envuelve al
// ORM solo para abrir `transaction(fn)`. NO es `ORM` directo — el service no opera
// contra el orm fuera de eso, y el analyzer lo acepta (regla "service no inyecta ORM").
// El index.ts construye el adapter `{ transaction: (fn) => orm.transaction(fn) }`.
import type { RepositoryAdapter, Logger, CacheAdapter, Auth } from 'arckode-framework'
import type {
  LandingBlockDTO, UpsertLandingBlockInput,
  PublicLandingBlock, CurrentUser,
} from './types'
import * as blocksCrud from './usecases/blocks-crud'
import type { LandingTransactor } from './usecases/blocks-crud'

export class LandingService {
  constructor(
    private readonly blocks: RepositoryAdapter<LandingBlockDTO>,
    private readonly hotels: RepositoryAdapter<any>,
    private readonly userRepo: RepositoryAdapter<any>,
    private readonly auth: Auth,
    private readonly transactor: LandingTransactor,
    private readonly logger: Logger,
    private readonly cache?: CacheAdapter,
  ) {}

  private deps(): blocksCrud.BlocksCrudDeps {
    return {
      blocks: this.blocks,
      hotels: this.hotels,
      userRepo: this.userRepo,
      auth: this.auth,
      transactor: this.transactor,
    }
  }

  /**
   * Lista los bloques del hotel del admin (9 defaults si el hotel no tiene ninguno).
   * Ordenado por `sortOrder` ASC. Dispara el seeder lazy en hotel nuevo.
   */
  async listByHotel(hotelId: string, user: CurrentUser): Promise<{ data: LandingBlockDTO[]; total: number }> {
    return blocksCrud.listByHotel(this.deps(), hotelId, user)
  }

  /**
   * Reemplazo atómico del array completo de bloques (spec: "Reorder atómico"). Si algo
   * falla a mitad, los bloques viejos se preservan (rollback de la transacción).
   */
  async upsert(
    hotelId: string,
    inputs: UpsertLandingBlockInput[],
    user: CurrentUser,
  ): Promise<LandingBlockDTO[]> {
    const created = await blocksCrud.upsert(this.deps(), hotelId, inputs, user)
    // Invalidar caché de listado público por hotel (clave exacta — el adapter no hace glob).
    if (this.cache) await this.cache.delete(`landing:public:${hotelId}`).catch(() => {})
    return created
  }

  /** Toggle rápido de `active` sin re-PUT todo el array. */
  async toggle(blockId: string, active: boolean, user: CurrentUser): Promise<LandingBlockDTO> {
    const updated = await blocksCrud.toggle(this.deps(), blockId, active, user)
    if (this.cache) await this.cache.delete(`landing:public:${updated.hotelId}`).catch(() => {})
    return updated
  }

  /**
   * Ruta pública: bloques `active=1` del hotel resuelto por `slug`, ordenados por
   * `sortOrder`. SIN auth (rate-limit en el index.ts). Dispara seeder lazy en hotel nuevo.
   */
  async listPublicBySlug(slug: string): Promise<{ data: PublicLandingBlock[] }> {
    return blocksCrud.listPublicBySlug(this.deps(), slug)
  }
}
