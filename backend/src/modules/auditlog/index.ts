// auditlog/index.ts — PUERTA PÚBLICA
// Solo esto es visible para otros módulos y conectores.
// ⚠ REGLA: Append-only. No sacar ni modificar exports existentes.

import { createModule, OrmRepository } from 'arckode-framework'
import { registerAuditlogModels } from './model'
import { AuditlogService } from './service'
import { AuditlogController } from './controller'
import type { AuditlogDTO } from './types'
import { createPermissionGuard } from '../../infrastructure/auth/create-permission-guard'

export { AuditlogService }
export type { AuditlogDTO, CreateAuditlogDTO, UpdateAuditlogDTO, AuditlogQuery, AuditlogPaginated } from './types'
export type { AuditlogSockets } from './sockets'
export { AuditlogValidator, CreateAuditlogSchema, UpdateAuditlogSchema } from './validators/schema'

export function AuditlogModule() {
  return createModule({
    name: 'auditlog',
    version: '2.0.0',
    description: 'Módulo de audit log — append-only',

    contract: {
      name: 'auditlog',
      version: '1.0.0',
      description: 'Módulo de auditlog',
      actions: ["list","getById","create"],
      events: ["onAuditlogCreated"],
      tables: ['audit_log'],
      dependencies: [],
      rules: ['No importar de otros módulos', 'Append-only: sin update ni delete'],
    },

    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('auditlog: auth dependency required')
      // Registrar modelo(s) — delegado a model.ts
      registerAuditlogModels(orm)

      const repo = new OrmRepository<AuditlogDTO>(orm, 'Auditlog')
      const userRepo = new OrmRepository<any>(orm, 'Users')
      const log = logger.child('auditlog')
      const service = new AuditlogService(repo, userRepo, log, cache, auth!)
      const controller = new AuditlogController(service, log)

      const roleRepo = new OrmRepository<any>(orm, 'Roles')
      const guard = createPermissionGuard(auth, roleRepo)

      router.get('/api/auditlog', guard('reports', 'view'), (req) => controller.index(req))
      router.get('/api/auditlog/:id', guard('reports', 'view'), (req) => controller.show(req))
      // SC-03: crear una entrada de auditoría exigía `reports:view` en vez de `reports:create`.
      router.post('/api/auditlog', guard('reports', 'create'), (req) => controller.store(req))

      log.info('Módulo auditlog listo')
      return service
    },
  })
}
