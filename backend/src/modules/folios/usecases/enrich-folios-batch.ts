// folios/usecases/enrich-folios-batch.ts — Enriquecido en LOTE del listado de folios.
//
// N+1 ELIMINADO (auditoría #274 / optimización #276):
//   ANTES: list() hacía `Promise.all(folios.map(enrichFolio))` y cada enrichFolio disparaba
//     chargeRepo.findMany({folioId}) más la carga individual del guest y del room (por su id)
//     => 3 queries POR FILA (3N para N folios; el listado no pagina => N sin cota).
//   AHORA: se bulk-cargan charges + guests + rooms UNA sola vez por hotel y se resuelve cada
//     folio contra Maps en memoria => O(k) queries (k = hoteles distintos en el resultado,
//     típicamente 1 para un merchant). El RepositoryAdapter NO soporta WHERE IN (buildWhere solo
//     hace `campo = ?`, ver kernel/db/orm-utils.ts), por eso el bulk filtra por hotelId — lo que
//     además respeta multi-tenancy.
//   Shape idéntico a enrichFolio con includeCharges=false: el listado nunca adjunta `charges`.

import type { FolioDTO, FolioChargeDTO } from '../types'
import { computeTotals } from './folio-math'
import type { EnrichFolioDeps } from './enrich-folio'

export async function enrichFoliosBatch(
  deps: EnrichFolioDeps,
  folios: FolioDTO[],
): Promise<FolioDTO[]> {
  if (!folios.length) return []
  const hotelIds = [...new Set(folios.map((f) => f.hotelId).filter(Boolean))] as string[]

  const chargesByFolio = new Map<string, FolioChargeDTO[]>()
  const guestName = new Map<string, string>()
  const roomNumber = new Map<string, string>()

  await Promise.all(
    hotelIds.map(async (hid) => {
      const [charges, guests, rooms] = await Promise.all([
        deps.chargeRepo.findMany({ hotelId: hid }).catch(() => [] as FolioChargeDTO[]),
        deps.guestRepo.findMany({ hotelId: hid }).catch(() => [] as any[]),
        deps.roomRepo.findMany({ hotelId: hid }).catch(() => [] as any[]),
      ])
      for (const c of charges as FolioChargeDTO[]) {
        if (!c.folioId) continue
        const arr = chargesByFolio.get(c.folioId)
        if (arr) arr.push(c)
        else chargesByFolio.set(c.folioId, [c])
      }
      for (const g of guests as any[]) if (g?.id) guestName.set(g.id, g.name ?? '')
      for (const rm of rooms as any[]) if (rm?.id) roomNumber.set(rm.id, rm.number ?? '')
    }),
  )

  return folios.map((f) => {
    const charges = chargesByFolio.get(f.id) ?? []
    const totals = computeTotals(charges)
    return {
      ...f,
      guestName: (f.guestId ? guestName.get(f.guestId) : '') ?? '',
      roomNumber: (f.roomId ? roomNumber.get(f.roomId) : '') ?? '',
      ...totals,
      charges: undefined,
    }
  })
}
