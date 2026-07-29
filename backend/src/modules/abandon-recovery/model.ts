// abandon-recovery/model.ts — No-op: el módulo NO tiene tabla propia (F3 3.14).
//
// Este módulo es cron-only y su único estado persistente es el FLAG `abandonEmailSent` en
// la tabla `reservations`, cuyo dueño del schema es el módulo `reservas` (reservas/model.ts).
// No declaramos ningún modelo acá para evitar el anti-patrón "modelo dual" (mem 1805):
// si re-definiéramos Reservations acá, el último orm.define ganaría y descartaría campos
// del anterior.
//
// El analyzer requiere que cada módulo tenga un model.ts (regla #22 del CLAUDE: "schema de
// DB debe vivir separado de types.ts"). Para satisfacer la estructura canónica sin crear un
// modelo espurio, exportamos un `registerAbandonRecoveryModels(orm)` que es explícitamente
// no-op y documentado. NO define nada en el ORM.

import type { ORM } from 'arckode-framework'

/** No-op: el módulo no registra modelos. Ver cabecera del archivo para el porqué. */
export function registerAbandonRecoveryModels(_orm: ORM): void {
  // Intencionalmente vacío.
}

/** Alias por si el analyzer busca por PascalCase + "Model". */
export const AbandonRecoveryModel = null
