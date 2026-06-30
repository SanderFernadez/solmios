// reservas/usecases/safe-emit.ts — Emisión resilient de sockets del módulo.
// Un socket es un side-effect hacia otros módulos (housekeeping, canales, CRM, auto-pago).
// NUNCA debe romper la operación principal de negocio (create/update/delete) si un conector
// externo falla. Se loguea el error (para investigar/reintentar) pero la request continúa.
// Extraído del service para mantenerlo < 200 líneas (gate arckode: no God Object).

import type { Logger } from 'arckode-framework'

type AsyncHandler = (...args: any[]) => Promise<void>

/**
 * Invoca un handler de socket opcional de forma resilient.
 * Si el handler está ausente o lanza, NO propaga la excepción: la loguea y continúa.
 */
export async function safeEmit(
  logger: Logger,
  name: string,
  handler: AsyncHandler | undefined,
  ...args: any[]
): Promise<void> {
  if (!handler) return
  try {
    await handler(...args)
  } catch (e) {
    logger.error(`socket ${name} falló (no bloquea la operación de reserva)`, { error: (e as Error).message })
  }
}
