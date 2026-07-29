// wallet-pass/usecases/duplicate-detector.ts — Detecta violación de UNIQUE en SQLite/PG.
//
// Spec: wallet-pass/spec.md "UNIQUE INDEX (reservationId)". El index físico lo crea
// `migrate-db.ts` (`wallet_passes_reservation ON wallet_passes(reservationId)`). El
// usecase `generate-pass.ts` captura el duplicate error y lo traduce a idempotente return.
//
// Mismo criterio que external-reviews/upsert-batch.isDuplicateError y
// folio-entries.isDuplicateError — replicado acá (4 líneas) para mantener el módulo aislado.
export function isDuplicateError(e: unknown): boolean {
  const msg = String((e as any)?.message ?? e).toLowerCase()
  return (
    msg.includes('unique constraint') ||          // SQLite: "UNIQUE constraint failed"
    msg.includes('duplicate key') ||              // Postgres: "duplicate key value violates unique constraint"
    msg.includes('constraint failed') ||
    msg.includes('wallet_passes_reservation')     // nombre físico del index (defensivo)
  )
}
