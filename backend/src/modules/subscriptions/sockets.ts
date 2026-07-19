// sockets.ts — Hooks para que otros módulos reaccionen al ciclo de la suscripción.
//
// Todavía sin consumidores: los avisos de "te quedan 2 días" y el corte por
// falta de pago van a colgarse de acá (connector → notificaciones/email), sin
// que este módulo tenga que conocerlos.

export interface SubscriptionSockets {
  /** Se creó una cuenta nueva y arrancó su prueba gratis. */
  onTrialStarted?: (payload: { hotelId: string; trialEndsAt: string }) => Promise<void>
  /** Se venció la prueba y se cortó el acceso. */
  onTrialExpired?: (payload: { hotelId: string }) => Promise<void>
  /** Cambió el estado de la suscripción (pagó, falló el cobro, se dio de baja). */
  onStatusChanged?: (payload: { hotelId: string; status: string }) => Promise<void>
}
