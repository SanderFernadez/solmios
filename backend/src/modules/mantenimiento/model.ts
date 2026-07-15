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
    /** Proveedor EXTERNO al que se le pasó el ticket (maintenance_providers.id),
     *  cuando no lo arregla el equipo interno. Es alternativo a `assignedTo`.
     *  Sin declararlo acá el ORM lo descarta en silencio (anti-patrón mem 1805). */
    providerId: { type: 'string' },
    /** Quién marcó el ticket como resuelto (users.id). Lo setea `complete()` con el
     *  usuario del token. Puede diferir de `assignedTo` (otro técnico lo cierra). */
    resolvedBy: { type: 'string' },
    /** Quién levantó el ticket. Trazabilidad: mantenimiento sabe a quién preguntarle.
     *  (No sirve para filtrar notificaciones: hoy la notificación es del hotel, sin
     *  destinatario — ver connectors/mantenimiento-notificaciones.) */
    reportedBy: { type: 'string' },
    /** Tarea de limpieza que originó el ticket. Deduplica el doble-toque de la app. */
    sourceTaskId: { type: 'string', indexed: true },
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

/**
 * SERVICIOS EXTERNOS: a quién llama el hotel cuando algo no se arregla adentro
 * (plomero, electricista, técnico de A/C). Un ticket se le puede asignar a uno de
 * estos en vez de a un técnico interno (`maintenance.providerId`).
 *
 * `active` es una baja LÓGICA: un ticket viejo puede seguir apuntando al proveedor,
 * y borrarlo de verdad dejaría el historial señalando a la nada.
 */
export const MaintenanceProviderModel: ModelDefinition = {
  table: 'maintenance_providers',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    name: { type: 'string', required: true },
    /** Rubro: plomería, electricidad, refrigeración… */
    specialty: { type: 'string' },
    phone: { type: 'string' },
    email: { type: 'string' },
    notes: { type: 'text' },
    /** Dirección o zona de cobertura. */
    address: { type: 'string' },
    /** Tarifa como texto libre ("RD$1500 por visita", "por hora"). */
    rate: { type: 'string' },
    /** Días que trabaja, CSV en inglés: "mon,tue,wed,thu,fri". */
    workDays: { type: 'string' },
    /** Horario de disponibilidad "HH:mm". */
    workStart: { type: 'string' },
    workEnd: { type: 'string' },
    active: { type: 'boolean', default: true },
  },
  timestamps: true,
}

export function registerMantenimientoModels(orm: ORM): void {
  orm.define('Maintenance', MantenimientoModel)
  orm.define('MaintenanceAudit', MantenimientoAuditModel)
  orm.define('MaintenanceProvider', MaintenanceProviderModel)
}
