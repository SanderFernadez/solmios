// folios/usecases/enrich-folio.ts — Completa el folio con totales, huésped y habitación.
// Extraído del service para mantenerlo < 200 líneas.

import type { RepositoryAdapter } from 'arckode-framework'
import type { FolioDTO, FolioChargeDTO } from '../types'
import { computeTotals } from './folio-math'

export interface EnrichFolioDeps {
  chargeRepo: RepositoryAdapter<FolioChargeDTO>
  guestRepo: RepositoryAdapter<any>
  roomRepo: RepositoryAdapter<any>
}

/** `includeCharges` adjunta el detalle de líneas; el listado no lo necesita. */
export async function enrichFolio(
  deps: EnrichFolioDeps,
  folio: FolioDTO,
  includeCharges = false,
): Promise<FolioDTO> {
  const charges = await deps.chargeRepo.findMany({ folioId: folio.id })
  const totals = computeTotals(charges as FolioChargeDTO[])
  const [guest, room] = await Promise.all([
    folio.guestId ? deps.guestRepo.findById(folio.guestId) : null,
    folio.roomId ? deps.roomRepo.findById(folio.roomId) : null,
  ])
  return {
    ...folio,
    guestName: (guest as any)?.name ?? '',
    roomNumber: (room as any)?.number ?? '',
    ...totals,
    charges: includeCharges ? (charges as FolioChargeDTO[]) : undefined,
  }
}
