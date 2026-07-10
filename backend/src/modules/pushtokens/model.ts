// pushtokens/model.ts — Schema de base de datos
// Responsabilidad ÚNICA: describir la estructura física de la tabla.
// Importado por index.ts → orm.define() para registrar el modelo.

import type { ModelDefinition, ORM } from 'arckode-framework'

/**
 * El token que Firebase le da a UNA instalación de la app.
 *
 * La clave natural es el `token`, no el usuario: la misma persona puede tener el
 * teléfono y una tablet, y el mismo teléfono cambia de dueño cuando entra la
 * camarera del turno noche. Por eso se busca por token antes de crear.
 */
export const PushTokensModel: ModelDefinition = {
  table: 'push_tokens',
  fields: {
    hotelId: { type: 'string', required: true },
    userId: { type: 'string', required: true },
    token: { type: 'string', required: true },
    platform: { type: 'string' },
  },
  timestamps: true,
}

export function registerPushTokensModels(orm: ORM): void {
  orm.define('PushTokens', PushTokensModel)
}
