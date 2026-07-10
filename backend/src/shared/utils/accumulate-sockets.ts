// shared/utils/accumulate-sockets.ts — Registro de sockets que ACUMULA, no pisa.
//
// Si dos conectores registran el mismo evento, ambos corren en cadena (secuencial). Sin esto, el
// segundo `setSockets` borraría al primero y un conector dejaría de funcionar en silencio.
//
// El mismo bloque estaba copiado en cada módulo.

export function accumulateSockets<T extends object>(current: T, next: Partial<T>): void {
  const incoming = next as Record<string, unknown>
  const registered = current as Record<string, unknown>

  for (const event of Object.keys(incoming)) {
    const handler = incoming[event] as ((...args: unknown[]) => Promise<void>) | undefined
    if (!handler) continue

    const previous = registered[event] as ((...args: unknown[]) => Promise<void>) | undefined
    registered[event] = previous
      ? async (...args: unknown[]) => { await previous(...args); await handler(...args) }
      : handler
  }
}
