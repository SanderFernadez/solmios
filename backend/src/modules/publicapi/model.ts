// publicapi/model.ts — Este módulo NO tiene tabla propia: es una fachada HTTP que expone
// rooms/reservations de `habitaciones`/`reservas` a integraciones externas autenticadas por
// API key. Mismo patrón que `modules/dashboard` (agregación cross-module sin tabla propia).

import type { ORM } from 'arckode-framework'

export function registerPublicapiModels(_orm: ORM): void {
  // sin modelos propios
}
