// shared/usecases/compose-sockets.ts — Composición de sockets para services que exponen setSockets.
// ACUMULA handlers: si dos connectors registran el mismo evento, ambos corren en cadena (secuencial),
// nunca se pisan. Mismo criterio que el setSockets inline de reservas/payments/canales, extraído para
// no reescribir el loop en cada módulo nuevo.
export function composeSockets(cur: Record<string, any>, next: Record<string, any>): void {
  for (const key of Object.keys(next)) {
    const h = next[key]
    if (!h) continue
    const prev = cur[key]
    cur[key] = prev ? async (...a: any[]) => { await prev(...a); await h(...a) } : h
  }
}
