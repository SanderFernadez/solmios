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
  },
  timestamps: true,
}

export function registerTtlockModels(orm: ORM): void {
  orm.define('LockDevices', LockDevicesModel)
  orm.define('LockCodes', LockCodesModel)
}
