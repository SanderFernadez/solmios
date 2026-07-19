import type { ModelDefinition, ORM } from 'arckode-framework'

export const LockDevicesModel: ModelDefinition = {
  table: 'lock_devices',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true },
    ttlockLockId: { type: 'string' },
    roomId: { type: 'string' },
    name: { type: 'string' },
    mac: { type: 'string' },
    batteryLevel: { type: 'number', default: 0 },
    status: { type: 'string', default: 'offline' },
    // Auto-generar el código al pagarse la seña, por cerradura. Default true (comportamiento previo).
    // Boolean → columna INTEGER (0/1). Filas viejas (NULL tras ADD COLUMN) se tratan como habilitado.
    autoCodesEnabled: { type: 'boolean', default: true },
  },
  timestamps: true,
}

export const LockCodesModel: ModelDefinition = {
  table: 'lock_codes',
  fields: {
    id: { type: 'string', required: true },
    lockId: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    reservationId: { type: 'string' },
    code: { type: 'string', required: true },
    codeType: { type: 'string', default: 'time' },
    startDate: { type: 'string' },
    endDate: { type: 'string' },
    status: { type: 'string', default: 'active' },
    ttlockKeyboardPwdId: { type: 'string' },
    sentVia: { type: 'string' },
    // ─── Llave maestra ──────────────────────────────────────────────────────
    // Un código de huésped pertenece a una RESERVA; una llave maestra pertenece
    // a una PERSONA y vive en todas las cerraduras a la vez. Cada fila es el PIN
    // en UNA cerradura; `masterKeyId` agrupa las de la misma llave para poder
    // revocarla entera y saber en cuántas puertas quedó aplicada.
    // OJO: un campo que no esté acá el ORM lo descarta sin avisar.
    userId: { type: 'string' },
    masterKeyId: { type: 'string', indexed: true },
    /** Nombre con el que se ve el código en la cerradura ("Maestra · Rosa Melo"). */
    label: { type: 'string' },
  },
  timestamps: true,
}

export function registerTtlockModels(orm: ORM): void {
  orm.define('LockDevices', LockDevicesModel)
  orm.define('LockCodes', LockCodesModel)
}
