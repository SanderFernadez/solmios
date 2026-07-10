// mantenimiento/model.ts — Schema de base de datos
import type { ModelDefinition, ORM } from 'arckode-framework'

export const MantenimientoModel: ModelDefinition = {
  table: 'maintenance',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    roomId: { type: 'string' },
    roomNumber: { type: 'string' },
    title: { type: 'string', required: true },
    description: { type: 'text' },
    category: { type: 'string', default: "general" },
    priority: { type: 'string', default: "medium" },
    status: { type: 'string', default: "open" },
    assignedTo: { type: 'string' },
    /** Quién levantó el ticket. Sin esto, avisar de un ticket nuevo despierta
     *  también al que acaba de crearlo. */
    reportedBy: { type: 'string' },
    estimatedCost: { type: 'number', default: 0 },
    reportedDate: { type: 'string' },
    resolvedDate: { type: 'string' },
    // Timer: startTime/endTime calculan duración en runtime (no se persiste duration)
    startTime: { type: 'string' },
    endTime: { type: 'string' },
    // Notas del técnico
    notes: { type: 'text' },
    // Fotos antes/después
    photos: { type: 'json', default: [] },
  },
  timestamps: true,
}

// Audit trail: registro de todos los cambios en órdenes de mantenimiento
export const MantenimientoAuditModel: ModelDefinition = {
  table: 'maintenance_audit',
  fields: {
    id: { type: 'string', required: true },
    orderId: { type: 'string', required: true, indexed: true },
    hotelId: { type: 'string', required: true, indexed: true },
    userId: { type: 'string', required: true },
    action: { type: 'string', required: true },
    oldValue: { type: 'text' },
    newValue: { type: 'text' },
    timestamp: { type: 'string', required: true },
  },
  timestamps: false,
}

export function registerMantenimientoModels(orm: ORM): void {
  orm.define('Maintenance', MantenimientoModel)
  orm.define('MaintenanceAudit', MantenimientoAuditModel)
}
