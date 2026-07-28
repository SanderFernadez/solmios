// landing/index.ts — PUERTA PÚBLICA del módulo landing_blocks (F1, spec landing-builder).
// ⚠ REGLA: Append-only. No sacar ni modificar exports existentes.
//
// Wiring: registra el modelo `LandingBlocks`, construye repos + service + controller,
// y expone 4 rutas:
//   GET    /api/landing                          admin (auth + landing:view)
//   PUT    /api/landing                          admin (auth + landing:edit) — bulk upsert atómico
//   PATCH  /api/landing/:id/toggle               admin (auth + landing:edit)
//   GET    /api/public/hotels/:slug/landing      pública (sin auth, rate-limited 30/min/IP)
import { createModule, OrmRepository } from 'arckode-framework'
import { registerLandingModels } from './model'
import { LandingService } from './service'
import { LandingController } from './controller'
import type { LandingBlockDTO, UpsertLandingBlockInput, PublicLandingBlock, LandingBlockType } from './types'
import { createPermissionGuard } from '../../infrastructure/auth/create-permission-guard'
import { requireUserType } from '../../infrastructure/auth/require-user-type'
import { rateLimit, getClientIp } from '../../shared/middlewares/rate-limit'

export { LandingService }
export type {
  LandingBlockDTO, UpsertLandingBlockInput, ToggleLandingBlockDTO,
  PublicLandingBlock, LandingBlockType, LandingBlockListResult, CurrentUser,
} from './types'
export type { LandingSockets } from './sockets'
export { LandingValidator, UpsertLandingSchema, ToggleLandingSchema } from './validators/schema'
export { BLOCK_TYPES, DEFAULT_SORT_ORDER } from './types'
export { registerLandingModels } from './model'
export { defaultConfigFor } from './usecases/defaults'

export function LandingModule() {
  return createModule({
    name: 'landing',
    version: '1.0.0',
    description: 'Landing pública del hotel por bloques (hero/gallery/amenities/...) — F1',

    contract: {
      name: 'landing',
      version: '1.0.0',
      description: 'Bloques configurables de la landing pública del hotel',
      actions: ['list', 'upsert', 'toggle', 'listPublic'],
      events: ['onLandingBlockUpserted', 'onLandingBlockToggled'],
      tables: ['landing_blocks'],
      dependencies: [],
      rules: [
        'Ownership por hotelId (auth.assertOwnership post-find)',
        '1 fila por (hotelId, type) — enforced en el usecase',
        'upsert atómico (orm.transaction: delete-all + insert-all)',
        'Seeder lazy: 9 defaults al primer GET de hotel nuevo',
      ],
    },

    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('landing: auth dependency required')
      registerLandingModels(orm)

      const blocks = new OrmRepository<LandingBlockDTO>(orm, 'LandingBlocks')
      const hotels = new OrmRepository<any>(orm, 'Hotels')
      const userRepo = new OrmRepository<any>(orm, 'Users')
      const log = logger.child('landing')
      // Transactor adapter: envuelve `orm.transaction` sin exponer el ORM al service
      // (regla "service no inyecta ORM directo" — el analyzer lo exige). El service
      // recibe solo la interface `LandingTransactor` de este módulo.
      const transactor = { transaction: <T>(fn: (tx: any) => Promise<T>) => orm.transaction(fn) }
      const service = new LandingService(blocks, hotels, userRepo, auth, transactor, log, cache)
      const controller = new LandingController(service, log)

      // Guard admin: userType merchant + permiso landing:view|edit. Mismo patrón que
      // opiniones/index.ts (createPermissionGuard + capa extra de userType).
      const roleRepo = new OrmRepository<any>(orm, 'Roles')
      const permGuard = createPermissionGuard(auth, roleRepo)
      const adminGuard = (action: 'view' | 'edit') => [
        ...permGuard('landing', action),
        requireUserType('merchant'),
      ]

      // ─── Rutas admin ──────────────────────────────────────────────────────
      router.get('/api/landing', adminGuard('view'), (req) => controller.index(req))
      router.put('/api/landing', adminGuard('edit'), (req) => controller.upsert(req))
      router.patch('/api/landing/:id/toggle', adminGuard('edit'), (req) => controller.toggle(req))

      // ─── Ruta pública ─────────────────────────────────────────────────────
      // Sin auth, rate-limited por IP (spec: 30 req/min/IP). El rate-limit va ANTES del
      // controller (mismo patrón que opiniones/index.ts:60-67 con public-reviews).
      router.get('/api/public/hotels/:slug/landing', async (req: any) => {
        const { allowed, retryAfter } = rateLimit(`public-landing:${getClientIp(req)}`, {
          maxAttempts: 30,
          windowMs: 60_000,
        })
        if (!allowed) return { status: 429, body: { error: 'Too many requests', retryAfter } }
        return controller.publicLanding(req)
      })

      log.info('Módulo landing listo')
      return service
    },
  })
}
