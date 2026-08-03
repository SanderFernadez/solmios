// shared/utils/async-lock.ts — Lock en memoria por clave (DT-11).
//
// Cierra carreras read-then-write DENTRO de un solo proceso: dos llamadas concurrentes con la
// misma `key` se sirven en FIFO, la segunda espera a que la primera termine (éxito o error)
// antes de arrancar. No sirve entre múltiples procesos/workers — para eso hace falta CAS a
// nivel DB (`update(id, data, {expect})`), que el framework hoy no expone (ver DT-11 en
// openspec/changes/deudas-tecnicas-pendientes). Prod corre 1 solo proceso systemd, así que esto
// cierra la carrera real de hoy sin SQL crudo ni cambios al framework.
const tails = new Map<string, Promise<unknown>>()

export function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const tail = tails.get(key) ?? Promise.resolve()
  const result = tail.then(fn, fn)
  // Swallow el resultado/error solo para encadenar al siguiente — `result` (lo que devolvemos
  // al caller) conserva el éxito/rechazo real de `fn`.
  const chained = result.then(() => undefined, () => undefined)
  tails.set(key, chained)
  chained.finally(() => { if (tails.get(key) === chained) tails.delete(key) })
  return result
}
