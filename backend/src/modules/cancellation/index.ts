// cancellation/index.ts — PUERTA PÚBLICA del módulo (F1 plan #627, políticas de cancelación).
// ⚠ REGLA: Append-only. No sacar ni modificar exports existentes.
//
// F1 (modelo + cálculo): registra el modelo `CancellationPolicies` (tabla
// `cancellation_policies`) y construye repo + service + controller. NO registra rutas
// HTTP — eso es F3. El cálculo de penalidades vive en shared/usecases/cancellation-math.ts.
//
// Resolución de políticas (resolvePolicy) y cálculo de penalidad (computePenalty) son
// funciones PURAS importables por reservas/bookingengine desde shared/usecases, sin
// acoplamiento runtime a este módulo (type-only import de Tier).
import { createModule, OrmRepository } from 'arckode-framework'
import { registerCancellationModels } from './model'
import { CancellationService } from './service'
import { CancellationController } from './controller'
import { createPermissionGuard } from '../../infrastructure/auth/create-permission-guard'
import type { CancellationPolicyDTO } from './types'

export { CancellationService }
export type {
  CancellationPolicyDTO, CreateCancellationPolicyDTO, UpdateCancellationPolicyDTO,
  CancellationQuery, CancellationPaginated, PolicyScope, Tier,
} from './types'
export type { CancellationSockets } from './sockets'
export { CancellationValidator, CreateCancellationPolicySchema, UpdateCancellationPolicySchema, UpsertBasePolicySchema, UpsertOverridePolicySchema } from './validators/schema'

export function CancellationModule() {
  return createModule({
    name: 'cancellation',
    version: '1.0.0',
    description: 'Políticas de cancelación por canal/tarifa/temporada (F1 plan #627)',

    contract: {
      name: 'cancellation',
      version: '1.0.0',
      description: 'Políticas de cancelación multi-nivel (base/channel/rate/season) + cálculo de penalidad',
      actions: ['list', 'getById', 'create', 'update', 'delete'],
      events: ['onCancellationCreated', 'onCancellationUpdated', 'onCancellationDeleted'],
      tables: ['cancellation_policies'],
      dependencies: [],
      rules: [
        'Ownership por hotelId (auth.assertOwnership post-find)',
        'scope enum cerrado: base | channel | rate | season',
        'Cálculo de penalidad en shared/usecases/cancellation-math.ts (funciones puras)',
      ],
    },

    create({ logger, orm, cache, router, auth }) {
      registerCancellationModels(orm)

      const repo = new OrmRepository<CancellationPolicyDTO>(orm, 'CancellationPolicies')
      const log = logger.child('cancellation')
      const service = new CancellationService(repo, log, cache)
      const controller = new CancellationController(service, log)

      // Guard de permisos: settings:view para leer, settings:edit para mutar.
      // Mismo patrón que pricing/index.ts. hotelId sale del token en el controller.
      if (auth && router) {
        const roleRepo = new OrmRepository<any>(orm, 'Roles')
        const guard = createPermissionGuard(auth, roleRepo)

        // CRUD admin de políticas (F3). El merchant configura base + overrides por canal.
        router.get('/api/cancellation-policies', guard('settings', 'view'), (req: any) => controller.list(req))
        router.put('/api/cancellation-policies/base', guard('settings', 'edit'), (req: any) => controller.upsertBase(req))
        router.post('/api/cancellation-policies/override', guard('settings', 'edit'), (req: any) => controller.upsertOverride(req))
        router.delete('/api/cancellation-policies/:id', guard('settings', 'edit'), (req: any) => controller.remove(req))
      }

      log.info('Módulo cancellation listo (F3: CRUD admin + modelo + cálculo)')
      return service
    },
  })
}
