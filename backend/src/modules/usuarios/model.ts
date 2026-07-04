// usuarios/model.ts — Schema de base de datos
import type { ModelDefinition, ORM } from 'arckode-framework'

export const UsuariosModel: ModelDefinition = {
  table: 'users',
  fields: {
    id: { type: 'string', required: true },
    name: { type: 'string', required: true },
    email: { type: 'string', required: true, unique: true, indexed: true },
    password: { type: 'string', required: true },
    userType: { type: 'string', default: 'merchant' }, // 'admin' | 'merchant'
    role: { type: 'string', default: 'hotel_admin' },
    hotelId: { type: 'string', indexed: true },
    active: { type: 'number', default: 1 },
    isDemo: { type: 'number', default: 0 },
    token: { type: 'string' },
    resetToken: { type: 'string', indexed: true },
    resetExpires: { type: 'number' },
    avatar: { type: 'string' },
    phone: { type: 'string' },
    // PIN auth para staff móvil (6 dígitos, bcrypt hash)
    pinHash: { type: 'string' },
    pinEnabled: { type: 'number', default: 0 },
    pinAttempts: { type: 'number', default: 0 },
    pinLockedUntil: { type: 'string' },
    pinSetAt: { type: 'string' },
  },
  timestamps: true,
}

export function registerUsuariosModels(orm: ORM): void {
  orm.define('Users', UsuariosModel)
}
