// sockets.ts — Hooks para que otros módulos reaccionen al programa de Aliados.
// Sin consumidores todavía: si en el futuro se quiere notificar por email cuando se genera
// una comisión, o cuando se aprueba/rechaza una certificación, va acá (mismo criterio que
// referrals/sockets.ts).

export interface AliadosSockets {
  /** Se generó una comisión nueva (el referido del Aliado validó). */
  onCommissionCreated?: (payload: { partnerId: string; percent: number; payoutMode: string }) => Promise<void>
  /** Se aprobó/rechazó una solicitud de certificación. */
  onCertificationReviewed?: (payload: { hotelId: string; status: 'approved' | 'rejected' }) => Promise<void>
}
