// external-reviews/index.ts — PUERTA PÚBLICA del módulo (F3, spec reputation-aggregator).
// ⚠ REGLA: Append-only. No sacar ni modificar exports existentes.
//
// Wiring: registra el modelo `ExternalReviews`, construye repos + service + controller, y
// expone 5 rutas admin (auth + permiso billing:*, mismo bloque que facturas/folios — las
// reseñas externas son datos de facturación/reputación del hotel):
//   GET    /api/external-reviews
//   GET    /api/external-reviews/:id
//   POST   /api/external-reviews
//   PUT    /api/external-reviews/:id
//   DELETE /api/external-reviews/:id
//
// F3 3.5 (solmi-direct-booking / reputation-aggregator): nueva ruta
//   POST   /api/external-reviews/sync-now   → dispara el pull manualmente para el hotel
//
// El cron NO pasa por las rutas: llama directo a `service.upsertBatch(hotelId, reviews)` vía
// `system.resolveModule('external-reviews')` (mismo molde que folios.postNightAuditRoomCharges).
//
// Permisos: `reviews:view|create|edit|delete` (HC: si no existe, cae a `billing:*` — ver
// createPermissionGuard). Hoteles con reviews externas necesitan el permiso en su rol.
import { createModule, OrmRepository } from 'arckode-framework'
import { registerExternalReviewsModels } from './model'
import { ExternalReviewsService } from './service'
import { ExternalReviewsController } from './controller'
import type { ExternalReviewDTO } from './types'
import type { ExternalReviewsFetchers } from '../../shared/usecases/external-reviews-cron'
import { createPermissionGuard } from '../../infrastructure/auth/create-permission-guard'
import { createModuleGuard } from '../../infrastructure/auth/require-module'
import { requireUserType } from '../../infrastructure/auth/require-user-type'

export { ExternalReviewsService, ExternalReviewsController }
export { registerExternalReviewsModels } from './model'
export type {
  ExternalReviewDTO, CreateExternalReviewDTO, UpdateExternalReviewDTO,
  ExternalReviewsQuery, ExternalReviewsPaginated, UpsertBatchResult,
  ExternalReviewSource, StayApiOta, NormalizedExternalReview, CurrentUser,
} from './types'
export type { ExternalReviewsSockets } from './sockets'
export {
  ExternalReviewsValidator,
  CreateExternalReviewSchema, UpdateExternalReviewSchema,
} from './validators/schema'

/**
 * Opciones del módulo. `fetchers` (inyectado desde composition-root) cablea el endpoint
 * "Sync now" (F3 3.5) a los mismos clients HTTP que usa el cron nightly. Si no se pasa
 * (tests), el endpoint responde 503 'Sync no disponible en este entorno'.
 */
export interface ExternalReviewsModuleOpts {
  fetchers?: ExternalReviewsFetchers
}

export function ExternalReviewsModule(opts: ExternalReviewsModuleOpts = {}) {
  return createModule({
    name: 'external-reviews',
    version: '1.0.0',
    description: 'Módulo de reseñas externas (Google/TripAdvisor/StayAPI) — F3 agregador',

    contract: {
      name: 'external-reviews',
      version: '1.0.0',
      description: 'External reviews (GBP/TripAdvisor/StayAPI) with dedup + batch upsert',
      actions: ['list', 'getById', 'create', 'update', 'delete', 'upsertBatch', 'syncNow'],
      events: [],
      tables: ['external_reviews'],
      dependencies: [],
      rules: [
        'Ownership por hotelId (auth.assertOwnership post-find)',
        'source y sourceExternalId inmutables post-create',
        'Unique (source, sourceExternalId) — error de constraint si se duplica',
        'Cron llama directo a service.upsertBatch (no pasa por HTTP)',
        'POST /sync-now dispara pull manual (permiso settings:edit)',
      ],
    },

    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('external-reviews: auth dependency required')
      registerExternalReviewsModels(orm)

      const repo = new OrmRepository<ExternalReviewDTO>(orm, 'ExternalReviews')
      const log = logger.child('external-reviews')
      const service = new ExternalReviewsService(repo, log, cache, { auth })
      const controller = new ExternalReviewsController(service, log)

      // Guard admin: mismo permiso que opiniones (`reports:*`) — las reseñas externas son
      // responsabilidad operacional del mismo equipo. + module guard (sales.reviews, igual
      // que opiniones) verifica que el hotel tenga el módulo en plan.modules + userType merchant.
      const roleRepo = new OrmRepository<any>(orm, 'Roles')
      const permGuard = createPermissionGuard(auth, roleRepo)
      const moduleGuard = createModuleGuard(orm)
      const adminGuard = (action: 'view' | 'create' | 'edit' | 'delete') => [
        ...permGuard('reports', action),
        moduleGuard('sales.reviews'),
        requireUserType('merchant'),
      ]

      router.get('/api/external-reviews', adminGuard('view'), (req) => controller.index(req))
      router.get('/api/external-reviews/:id', adminGuard('view'), (req) => controller.show(req))
      router.post('/api/external-reviews', adminGuard('create'), (req) => controller.store(req))
      router.put('/api/external-reviews/:id', adminGuard('edit'), (req) => controller.update(req))
      router.delete('/api/external-reviews/:id', adminGuard('delete'), (req) => controller.destroy(req))

      // F3 3.5 — "Sync now": dispara el pull manualmente para el hotel del JWT.
      // Permiso: `settings:edit` (spec.md:96-110 permite crear `reputation:edit` O reusar
      // `settings:edit` — reusamos para no agregar un permiso nuevo a la matriz y porque
      // conceptualmente es "editar la config de reputación"). Misma path-base que el CRUD
      // admin, así que se ve junto en el panel de hoteles con permisos `reports:*` o
      // `settings:edit`. Si no hay fetchers inyectados (tests), responde 503.
      const syncGuard = [...permGuard('settings', 'edit'), moduleGuard('sales.reviews'), requireUserType('merchant')]
      router.post('/api/external-reviews/sync-now', syncGuard, (req) =>
        controller.syncNow(req, {
          orm,
          resolveModule: (name: string) => (name === 'external-reviews' ? service : null),
          fetchers: opts.fetchers,
          cache,
        }),
      )

      log.info('Módulo external-reviews v1 listo (CRUD + sync-now)')
      return service
    },
  })
}
