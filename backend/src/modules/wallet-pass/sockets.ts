// wallet-pass/sockets.ts — Hooks OPCIONALES hacia otros módulos (F3).
// Por ahora vacío: el módulo es consumido pasivamente por el connector `reservas-wallet`
// que subscribe a `onBookingPaid` (bookingengine) y dispara `generatePass`.
// Si el día de mañana hace falta emitir eventos (ej. "pass regenerado" para que el
// frontend refresque la confirmación), definir el socket acá y cablearlo en el service.

export interface WalletPassSockets {
  // Ejemplo futuro (espec.md:84-92 — Pass regenera si cambia room assignment):
  // onPassRegenerated?: (payload: { reservationId: string; oldPassId: string; newPassId: string }) => Promise<void>
}
