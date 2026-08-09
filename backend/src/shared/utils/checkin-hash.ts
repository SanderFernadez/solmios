// shared/utils/checkin-hash.ts — Hash público del link de pre-checkin (`/checkin/:hash`).
//
// Determinístico a partir del id de la reserva: sin guiones, primeros 12 caracteres.
// Única fuente de verdad — reservas-queries.ts (resolver el hash entrante) y
// auto-messages-cron.ts (armar el link saliente) DEBEN coincidir en cómo se deriva.
export function checkinHashFromId(id: string): string {
  return String(id).replace(/-/g, '').slice(0, 12)
}
