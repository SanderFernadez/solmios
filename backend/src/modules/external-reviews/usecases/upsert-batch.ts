// external-reviews/usecases/upsert-batch.ts — Ingesta batch con dedup (F3, task 3.3).
//
// Extraído del service.ts para evitar God Object (>200 líneas). El service delega acá
// cuando el cron nightly dispara `service.upsertBatch(hotelId, reviews)`.
//
// Spec: reputation-aggregator/spec.md "Dedup por (source, sourceExternalId)".
//
// Estrategia (semántica "ON CONFLICT" a nivel application + DB):
//  1. Pre-fetch de las reviews existentes del (hotelId, source) para cada fuente en el batch,
//     indexadas por sourceExternalId en memoria (1 query por source envuelto).
//  2. Para cada review incoming:
//     - Si existe → update campos mutables (rating/title/comment/authorName/language/
//       submittedAt/url). NO toca source/sourceExternalId (inmutables, forman el UNIQUE).
//     - Si no existe → create.
//  3. Race safety: si entre el fetch y el create otra txn insertó la misma fila, el UNIQUE
//     index del DB (`external_reviews_source_extid`) la rechaza → captura el duplicate error
//     → re-fetch + update. Es el mismo patrón que folio-entries.createChargeIdempotent.
//
// Idempotente (spec.md:64-71): correr 2× no duplica — todas las reviews ya están → 0 inserts.
// El UNIQUE index físico es la garantía definitiva; este código es la capa application
// para evitar el costo del try/error en cada fila.
//
// Anti-patrón ORM (mem 1805): TODO campo que se persiste/create/update está declarado en
// `model.ts` (case-sensitive). Renombrar un campo en el modelo = columna orphan.
import type { RepositoryAdapter } from 'arckode-framework'
import type {
  ExternalReviewDTO, UpsertBatchResult, NormalizedExternalReview, ExternalReviewSource,
} from '../types'

/**
 * Detecta violación de UNIQUE/PK en SQLite y Postgres (mensajes distintos por motor).
 * Mismo criterio que folio-entries.isDuplicateError / promo-crud.isDuplicateError —
 * replicado acá (no importado) para mantener el módulo aislado (4 líneas, no acoplar).
 */
export function isDuplicateError(e: unknown): boolean {
  const msg = String((e as any)?.message ?? e).toLowerCase()
  return (
    msg.includes('unique constraint') ||            // SQLite: "UNIQUE constraint failed"
    msg.includes('duplicate key') ||                 // Postgres: "duplicate key value violates unique constraint"
    msg.includes('constraint failed') ||
    msg.includes('external_reviews_source_extid')    // nombre físico del index (defensivo)
  )
}

/** Construye el payload de campos mutables para `repo.update`. No incluye source/sourceExternalId. */
function mutableUpdateFrom(rev: NormalizedExternalReview): Partial<Omit<ExternalReviewDTO, 'id' | 'source' | 'sourceExternalId' | 'hotelId' | 'createdAt' | 'updatedAt'>> {
  return {
    rating: rev.rating,
    title: rev.title,
    comment: rev.comment,
    authorName: rev.authorName,
    language: rev.language,
    submittedAt: rev.submittedAt,
    url: rev.url,
  }
}

/** Construye el payload para `repo.create` (campos del modelo, sin id/timestamps que arma el ORM). */
function createPayloadFrom(hotelId: string, rev: NormalizedExternalReview): Omit<ExternalReviewDTO, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    hotelId,
    source: rev.source,
    sourceExternalId: rev.sourceExternalId,
    authorName: rev.authorName,
    rating: rev.rating,
    title: rev.title,
    comment: rev.comment,
    language: rev.language,
    submittedAt: rev.submittedAt,
    url: rev.url,
  }
}

export interface UpsertBatchDeps {
  repo: RepositoryAdapter<ExternalReviewDTO>
}

/**
 * Upsert batch dedupeando por `(source, sourceExternalId)`. Punto de entrada del cron.
 *
 * @returns conteo `{ inserted, updated }` para telemetría y "Sync now".
 */
export async function upsertBatch(
  deps: UpsertBatchDeps,
  hotelId: string,
  incoming: NormalizedExternalReview[],
): Promise<UpsertBatchResult> {
  if (incoming.length === 0) return { inserted: 0, updated: 0 }

  // 1) Pre-fetch existing por source (1 query por source en el batch).
  const sourcesInBatch = Array.from(new Set(incoming.map((r) => r.source))) as ExternalReviewSource[]
  const existingBySource = new Map<ExternalReviewSource, Map<string, ExternalReviewDTO>>()
  for (const source of sourcesInBatch) {
    const rows = await deps.repo.findMany({ hotelId, source } as Record<string, unknown>)
    const byExtId = new Map<string, ExternalReviewDTO>()
    for (const row of rows) {
      if (row.sourceExternalId) byExtId.set(row.sourceExternalId, row)
    }
    existingBySource.set(source, byExtId)
  }

  // 2) Iterar el batch: create o update según exista o no.
  let inserted = 0
  let updated = 0
  for (const rev of incoming) {
    const byExtId = existingBySource.get(rev.source)
    const existing = rev.sourceExternalId ? byExtId?.get(rev.sourceExternalId) : undefined

    if (existing) {
      await deps.repo.update(existing.id, mutableUpdateFrom(rev) as Partial<Omit<ExternalReviewDTO, 'id'>>)
      updated++
      continue
    }

    try {
      await deps.repo.create(createPayloadFrom(hotelId, rev) as Omit<ExternalReviewDTO, 'id'>)
      inserted++
    } catch (e: unknown) {
      // Race: otra txn insertó la misma (source, sourceExternalId) entre nuestro fetch y create.
      if (!isDuplicateError(e)) throw e
      const refetch = await deps.repo.findMany({
        hotelId, source: rev.source, sourceExternalId: rev.sourceExternalId,
      } as Record<string, unknown>)
      const existingNow = refetch[0]
      if (!existingNow) throw e // no debería pasar: el duplicate dice que existe
      await deps.repo.update(existingNow.id, mutableUpdateFrom(rev) as Partial<Omit<ExternalReviewDTO, 'id'>>)
      updated++
    }
  }

  return { inserted, updated }
}
