// auditlog/index.ts — PUERTA PÚBLICA
// Solo esto es visible para otros módulos y conectores.
// ⚠ REGLA: Append-only. No sacar ni modificar exports existentes.

import { createModule, OrmRepository } from 'arckode-framework'
import { registerAuditlogModels } from './model'
import { AuditlogService } from './service'
import { AuditlogController } from './controller'
import type { AuditlogDTO } from './types'

export { AuditlogService }
export type { AuditlogDTO, CreateAuditlogDTO, UpdateAuditlogDTO, AuditlogQuery, AuditlogPaginated } from './types'
export type { AuditlogSockets } from './sockets'
export { AuditlogValidator, CreateAuditlogSchema, UpdateAuditlogSchema } from './validators/schema'

export function AuditlogModule() {
  return createModule({
    name: 'auditlog',
    version: '1.0.0',
    description: 'Módulo de auditlog',

    contract: {
      name: 'auditlog',
      version: '1.0.0',
      description: 'Módulo de auditlog',
      actions: ["list","getById","create"],
      events: ["onAuditlogCreated"],
      tables: ['auditlog'],
      dependencies: [],
      rules: ['No importar de otros módulos', 'Append-only: sin update ni delete'],
    },

    create({ logger, orm, cache, router, auth }) {
      // Registrar modelo(s) — delegado a model.ts
      registerAuditlogModels(orm)

      const repo = new OrmRepository<AuditlogDTO>(orm, 'Auditlog')
      const userRepo = new OrmRepository<any>(orm, 'Users')
      const log = logger.child('auditlog')
      const service = new AuditlogService(repo, userRepo, log, cache, auth!)
      const controller = new AuditlogController(service, log)

      // Append-only: solo GET y POST. Sin PUT/DELETE.
      router.get('/api/auditlog', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.index(req))
      router.get('/api/auditlog/:id', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.show(req))
      router.post('/api/auditlog', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.store(req))

      log.info('Módulo auditlog listo')
      return service
    },
  })
}
