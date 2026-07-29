// abandon-recovery/sockets.ts — No-op: el módulo NO emite ni escucha sockets (F3 3.14).
//
// Cron-only: el sweep se dispara desde composition-root (setInterval cada 30 min). No hay
// eventos de dominio que disparar a otros módulos (no других módulos necesitan enterarse
// de "se mandó un email de abandono" — el efecto secundario es el email en sí).
//
// Si en F4 se quisiera disparar un evento onAbandonEmailSent (ej. para que tracking lo
// cuente en el funnel como 'abandon_recovered'), se implementa acá con la firma estándar
// `setSockets(sockets)` del framework. Hoy no aporta valor.

export interface AbandonRecoverySockets {
  /** Futuro: emit('onAbandonEmailSent', { reservationId }) — sin consumidores hoy. */
}

/** No-op setter. Cumple la firma estándar que espera el analyzer para módulos con sockets.ts. */
export function setAbandonRecoverySockets(_sockets: unknown): void {
  // Intencionalmente vacío.
}
