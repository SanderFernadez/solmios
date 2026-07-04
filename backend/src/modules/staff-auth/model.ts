// model.ts — StaffAuth: no crea tabla nueva, extiende Users con campos PIN
import type { ORM } from 'arckode-framework'

export function registerStaffAuthModels(orm: ORM): void {
  // Los campos PIN (pinHash, pinEnabled, pinAttempts, pinLockedUntil) se agregan
  // al modelo Users existente en usuarios/model.ts
  // Esta función se llama para asegurar que el ORM registre el modelo Users
}
