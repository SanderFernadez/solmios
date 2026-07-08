// facturas/index.ts — PUERTA PÚBLICA
// Solo esto es visible para otros módulos y conectores.
// ⚠ REGLA: Append-only. No sacar ni modificar exports existentes.

import { createModule, OrmRepository } from 'arckode-framework'
import { registerFacturasModels } from './model'
import { FacturasService } from './service'
import { FacturasController } from './controller'
import type { FacturasDTO } from './types'
import { createPermissionGuard } from '../../infrastructure/auth/create-permission-guard'

export { FacturasService }
export type { FacturasDTO, CreateFacturasDTO, UpdateFacturasDTO, FacturasQuery, FacturasListResult } from './types'
export type { FacturasSockets } from './sockets'
export { FacturasValidator, CreateFacturasSchema, UpdateFacturasSchema, PayFacturasSchema, CreditNoteSchema } from './validators/schema'
export type { AuditPort, AuditEntry, AuditAction } from './usecases/audit'

export function FacturasModule() {
  return createModule({
    name: 'facturas',
    version: '2.0.0',
    description: 'Facturas con ownership, paginacion y validacion',

    contract: {
      name: 'facturas',
      version: '2.0.0',
      description: 'Facturas con ownership, paginacion y validacion',
      actions: ["list","getById","create","pay","update","delete","email"],
      events: ["onFacturasCreated","onFacturasUpdated","onFacturasDeleted"],
      tables: ['invoices', 'invoice_items'],
      dependencies: [],
      rules: ['Ownership check required', 'hotelId not updatable'],
    },

    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('facturas: auth dependency required')
      // Registrar modelo(s) — delegado a model.ts
      registerFacturasModels(orm)

      const repo = new OrmRepository<FacturasDTO>(orm, 'Invoices')
      const configRepo = new OrmRepository<any>(orm, 'Configuration')
      const guestRepo = new OrmRepository<any>(orm, 'Guests')
      const reservationRepo = new OrmRepository<any>(orm, 'Reservations')
      const roomRepo = new OrmRepository<any>(orm, 'Rooms')
      const userRepo = new OrmRepository<any>(orm, 'Users')
      const hotelRepo = new OrmRepository<any>(orm, 'Hotels')
      const itemRepo = new OrmRepository<any>(orm, 'InvoiceItem')
      const log = logger.child('facturas')
      const service = new FacturasService(repo, configRepo, { guest: guestRepo, reservation: reservationRepo, room: roomRepo }, userRepo, log, cache, auth!, itemRepo)
      const controller = new FacturasController(service, log, hotelRepo)

      const roleRepo = new OrmRepository<any>(orm, 'Roles')
      const guard = createPermissionGuard(auth, roleRepo)

      router.get('/api/facturas', guard('billing', 'view'), (req) => controller.index(req))
      router.get('/api/facturas/stats', guard('billing', 'view'), (req) => controller.stats(req))
      router.get('/api/facturas/tax-report', guard('billing', 'view'), (req) => controller.taxReport(req))
      router.get('/api/facturas/:id', guard('billing', 'view'), (req) => controller.show(req))
      router.get('/api/facturas/:id/print', guard('billing', 'view'), (req) => controller.printInvoice(req))
      router.get('/api/facturas/:id/pdf', guard('billing', 'view'), (req) => controller.pdf(req))
      router.post('/api/facturas', guard('billing', 'create'), (req) => controller.store(req))
      router.post('/api/facturas/:id/pay', guard('billing', 'edit'), (req) => controller.pay(req))
      router.post('/api/facturas/:id/credit-note', guard('billing', 'edit'), (req) => controller.creditNote(req))
      router.post('/api/facturas/:id/email', guard('billing', 'edit'), (req) => controller.email(req))
      router.put('/api/facturas/:id', guard('billing', 'edit'), (req) => controller.update(req))
      router.delete('/api/facturas/:id', guard('billing', 'delete'), (req) => controller.destroy(req))

      log.info('Módulo facturas listo')
      return service
    },
  })
}
