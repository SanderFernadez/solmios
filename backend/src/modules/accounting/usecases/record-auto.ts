// accounting/usecases/record-auto.ts — Asiento automático desde un conector (CTB-4).
// Recibe líneas con CÓDIGO de cuenta (no id): las resuelve contra el plan del hotel, crea el
// asiento y lo postea directo. Idempotente (dedup por reference+referenceType en createJournalEntry).
//
// Self-gating: si el hotel no tiene el plan de cuentas seedeado (algún código no resuelve), es
// no-op — así la contabilidad automática solo corre para hoteles que la configuraron. Best-effort:
// el conector envuelve la llamada en try/catch, un fallo acá nunca rompe el módulo origen.
import { createJournalEntry, postEntry, type JournalDeps } from './journal-entry'

export interface AutoLineInput { code: string; debit?: number; credit?: number; description?: string }

export interface RecordAutoInput {
  entryDate: string
  reference?: string
  referenceType?: string
  description?: string
  lines: AutoLineInput[]
}

export async function recordAutoEntry(
  deps: JournalDeps, hotelId: string, input: RecordAutoInput,
): Promise<{ id?: string; skipped?: boolean; deduped?: boolean }> {
  if (!hotelId || !Array.isArray(input.lines) || input.lines.length < 2) return { skipped: true }
  // Resolver códigos → accountId. Si falta alguno (hotel sin plan de cuentas), no-op.
  const resolved: { accountId: string; debit?: number; credit?: number; description?: string }[] = []
  for (const l of input.lines) {
    const acc = (await deps.accounts.findMany({ hotelId, code: l.code }))[0]
    if (!acc) return { skipped: true }
    resolved.push({ accountId: acc.id, debit: l.debit, credit: l.credit, description: l.description })
  }
  const res = await createJournalEntry(deps, hotelId, {
    entryDate: input.entryDate, description: input.description,
    reference: input.reference, referenceType: input.referenceType, source: 'connector',
    lines: resolved,
  })
  // Los asientos automáticos se postean directo (no quedan en draft). Si vino dedupeado, ya estaba.
  if (!res.deduped) await postEntry(deps, res.id, hotelId)
  return { id: res.id, deduped: res.deduped }
}
