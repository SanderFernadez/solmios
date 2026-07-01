// facturas/index.ts — PUERTA PÚBLICA
// Solo esto es visible para otros módulos y conectores.
// ⚠ REGLA: Append-only. No sacar ni modificar exports existentes.

import { createModule, OrmRepository } from 'arckode-framework'
import { registerFacturasModels } from './model'
import { FacturasService } from './service'
import { FacturasController } from './controller'
import type { FacturasDTO } from './types'

export { FacturasService }
export type { FacturasDTO, CreateFacturasDTO, UpdateFacturasDTO, FacturasQuery, FacturasListResult } from './types'
export type { FacturasSockets } from './sockets'
export { FacturasValidator, CreateFacturasSchema, UpdateFacturasSchema, PayFacturasSchema, CreditNoteSchema } from './validators/schema'

export function FacturasModule() {
  return createModule({
    name: 'facturas',
    version: '2.0.0',
    description: 'Facturas con ownership, paginacion y validacion',

    contract: {
      name: 'facturas',
      version: '2.0.0',
      description: 'Facturas con ownership, paginacion y validacion',
      actions: ["list","getById","create","pay","update","delete"],
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

      // Rutas públicas por defecto — agregar [auth.authenticate()] para proteger
      router.get('/api/facturas', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.index(req))
      router.get('/api/facturas/stats', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.stats(req))
      router.get('/api/facturas/tax-report', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.taxReport(req))
      router.get('/api/facturas/:id', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.show(req))
      router.get('/api/facturas/:id/print', (req) => controller.printInvoice(req))
      router.post('/api/facturas', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.store(req))
      router.post('/api/facturas/:id/pay', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.pay(req))
      router.post('/api/facturas/:id/credit-note', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.creditNote(req))
      router.put('/api/facturas/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.update(req))
      router.delete('/api/facturas/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.destroy(req))

      log.info('Módulo facturas listo')
      return service
    },
  })
}
