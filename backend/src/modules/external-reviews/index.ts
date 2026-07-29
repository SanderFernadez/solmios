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

export function ExternalReviewsModule() {
  return createModule({
    name: 'external-reviews',
    version: '1.0.0',
    description: 'Módulo de reseñas externas (Google/TripAdvisor/StayAPI) — F3 agregador',

    contract: {
      name: 'external-reviews',
      version: '1.0.0',
      description: 'External reviews (GBP/TripAdvisor/StayAPI) with dedup + batch upsert',
      actions: ['list', 'getById', 'create', 'update', 'delete', 'upsertBatch'],
      events: [],
      tables: ['external_reviews'],
      dependencies: [],
      rules: [
        'Ownership por hotelId (auth.assertOwnership post-find)',
        'source y sourceExternalId inmutables post-create',
        'Unique (source, sourceExternalId) — error de constraint si se duplica',
        'Cron llama directo a service.upsertBatch (no pasa por HTTP)',
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

      log.info('Módulo external-reviews v1 listo')
      return service
    },
  })
}
