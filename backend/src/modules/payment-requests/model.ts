// payment-requests/model.ts — El modelo PaymentRequests vive en shared/models.ts.
// Es cross-cutting (lo usan reservas/auto-PR, reservation-detail y este módulo),
// por eso su dueño canónico es shared/models.ts → registerSharedModels(orm), que
// composition-root invoca una vez. No se redefine aquí para evitar doble orm.define.
//
// Si en el futuro PaymentRequests deja de ser cross-cutting, mover la definición
// desde shared/models.ts a este archivo y activar el orm.define de abajo.

import type { ORM } from 'arckode-framework'

/** No-op: el modelo PaymentRequests lo registra registerSharedModels(orm) en composition-root. */
export function registerPaymentRequestModels(_orm: ORM): void {
  // Intencionalmente vacío. Ver shared/models.ts.
}
