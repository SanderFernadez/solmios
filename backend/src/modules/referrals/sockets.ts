// sockets.ts — Hooks para que otros módulos reaccionen al programa de referidos.
// Sin consumidores todavía: si en el futuro se quiere notificar por email cuando un crédito
// se libera, o mandar un aviso al referidor cuando su referido empieza a pagar, va acá.

export interface ReferralSockets {
  /** Se liberó un crédito real (cupón aplicado en Stripe) para el referidor. */
  onCreditReleased?: (payload: { referrerHotelId: string; monthsGranted: number }) => Promise<void>
}
