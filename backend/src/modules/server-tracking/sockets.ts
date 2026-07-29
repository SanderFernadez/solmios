// server-tracking/sockets.ts — Hooks OPCIONALES hacia otros módulos (F3).
// Por ahora sin sockets: el módulo es consumido vía `service.fireAll(reservationId)`
// desde el connector `bookingengine-tracking` que escucha `bookingengine.onBookingPaid`.
// Socket `onTrackingFired` se agrega cuando otro módulo quiera reaccionar a un fire
// (ej. invalidar cache de reportes de conversiones).

export interface ServerTrackingSockets {
  // Placeholder — versión 1 no emite eventos.
}
