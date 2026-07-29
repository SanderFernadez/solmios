import { createModule, OrmRepository } from 'arckode-framework'
import { registerOpinionesModels } from './model'
import { OpinionesService } from './service'
import { OpinionesController } from './controller'
import type { OpinionesDTO } from './types'
import type { ExternalReviewDTO } from '../external-reviews/types'
import { registerExternalReviewsModels } from '../external-reviews/model'
import { createPermissionGuard } from '../../infrastructure/auth/create-permission-guard'
import { createModuleGuard } from '../../infrastructure/auth/require-module'
import { rateLimit, getClientIp } from '../../shared/middlewares/rate-limit'

export { OpinionesService }
export type { OpinionesDTO, CreateOpinionesDTO, UpdateOpinionesDTO, OpinionesQuery, OpinionesPaginated } from './types'
export type { OpinionesSockets } from './sockets'
export { OpinionesValidator, CreateOpinionesSchema, UpdateOpinionesSchema } from './validators/schema'

export function OpinionesModule() {
  return createModule({
    name: 'opiniones',
    version: '2.0.0',
    description: 'Módulo de opiniones — reseñas de huéspedes',
    contract: {
      name: 'opiniones',
      version: '2.0.0',
      description: 'Reviews with ownership and pagination',
      actions: ['list', 'getById', 'create', 'update', 'delete'],
      events: ['onOpinionesCreated', 'onOpinionesUpdated', 'onOpinionesDeleted'],
      tables: ['reviews'],
      dependencies: [],
      rules: ['Ownership check required', 'hotelId not updatable'],
    },
    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('opiniones: auth dependency required')
      registerOpinionesModels(orm)
      // F3 3.4 — registra también el modelo ExternalReviews acá para que el repo que
      // inyectamos en el controller (lectura en el endpoint público) funcione aunque el
      // módulo external-reviews no esté cargado en esta instancia. Idempotente (orm.define
      // usa Map.set) — si external-reviews ya lo registró, este es no-op.
      registerExternalReviewsModels(orm)
      const repo = new OrmRepository<OpinionesDTO>(orm, 'Reviews')
      const externalReviewsRepo = new OrmRepository<ExternalReviewDTO>(orm, 'ExternalReviews')
      const log = logger.child('opiniones')
      const userRepo = new OrmRepository<any>(orm, 'Users')
      const hotelRepo = new OrmRepository<any>(orm, 'Hotels')
      const service = new OpinionesService(repo, log, cache, userRepo, auth)
      const controller = new OpinionesController(service, log, hotelRepo, repo, cache, externalReviewsRepo)

      const roleRepo = new OrmRepository<any>(orm, 'Roles')
      const permGuard = createPermissionGuard(auth, roleRepo)
      const moduleGuard = createModuleGuard(orm)
      const guard = (m: string, a: string) => [...permGuard(m, a), moduleGuard('sales.reviews')]

      router.get('/api/opiniones', guard('reports', 'view'), (req) => controller.index(req))
      router.get('/api/opiniones/:id', guard('reports', 'view'), (req) => controller.show(req))
      router.post('/api/opiniones', guard('reports', 'create'), (req) => controller.store(req))
      router.put('/api/opiniones/:id', guard('reports', 'edit'), (req) => controller.update(req))
      router.delete('/api/opiniones/:id', guard('reports', 'delete'), (req) => controller.destroy(req))

      // Público: el huésped responde el invite de reseña vía /resena/:token (sin login). El token es
      // la autorización (único por reseña, tenant-safe). Cerrado tras responder (409 si ya está).
      router.get('/api/public/reviews/:token', (req: any) => controller.publicGet(req))
      router.post('/api/public/reviews/:token', (req: any) => controller.publicSubmit(req))

      // F0 0.11 — Reseñas públicas en la web directa (spec public-reviews/spec.md:132-166).
      // Sin auth, rate-limited por IP (60 req/min — ver spec.md:96-97 y public-hotel-info).
      // El controller resuelve hotel por slug, aplica flags publishReview* y devuelve el DTO
      // allow-list (sin guestId/token/response/hotelId).
      router.get('/api/public/hotels/:slug/reviews', async (req: any) => {
        const { allowed, retryAfter } = rateLimit(`public-reviews:${getClientIp(req)}`, {
          maxAttempts: 60,
          windowMs: 60_000,
        })
        if (!allowed) return { status: 429, body: { error: 'Too many requests', retryAfter } }
        return controller.publicList(req)
      })

      log.info('Módulo opiniones v2 listo')
      return service
    },
  })
}
