// external-reviews/sockets.ts — Hooks OPCIONALES hacia otros módulos (F3).
// Por ahora vacío: el módulo es consumido pasivamente por el aggregate de opiniones (F0 0.10)
// al leer la tabla vía ORM (no requiere eventos). Si F3.4 o F3.5 necesitan disparar acciones
// al ingestar reviews (ej. notificar al admin "N reviews nuevas"), definir el socket acá y
// cablearlo en `service.setSockets` desde el connector correspondiente.

export interface ExternalReviewsSockets {
  // Ejemplo futuro:
  // onReviewsIngested?: (payload: { hotelId: string; inserted: number; updated: number }) => Promise<void>
}
