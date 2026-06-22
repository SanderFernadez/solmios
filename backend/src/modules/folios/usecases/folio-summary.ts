// folios/usecases/folio-summary.ts
// Resumen de un folio para generar factura: subtotal, taxes, total.
// Extraído del service para mantenerlo <200 líneas. Mezcla cálculo (folio-math) + persistencia (repos).

import type { RepositoryAdapter, Auth } from 'arckode-framework'
import type { FolioDTO, FolioChargeDTO, CurrentUser } from '../types'
import { computeTotals } from './folio-math'

export interface FolioSummaryDeps {
  folioRepo: RepositoryAdapter<FolioDTO>
  chargeRepo: RepositoryAdapter<FolioChargeDTO>
  userRepo: RepositoryAdapter<any>
  auth: Auth
}

export async function folioSummary(
  deps: FolioSummaryDeps,
  folioId: string,
  user?: CurrentUser,
): Promise<{ folio: FolioDTO; subtotal: number; taxes: number; total: number } | null> {
  const folio = await deps.folioRepo.findById(folioId)
  if (!folio) return null
  if (user) {
    const me = await deps.userRepo.findById(user.id)
    deps.auth.assertOwnership(folio.hotelId, me?.hotelId ?? '', user.role, 'super_admin')
  }
  const charges = (await deps.chargeRepo.findMany({ folioId })) as FolioChargeDTO[]
  const t = computeTotals(charges)
  const taxes = charges.filter((c) => c.kind === 'charge').reduce((s, c) => s + Number(c.taxes || 0), 0)
  return { folio: { ...folio, ...t }, subtotal: t.chargesTotal - taxes, taxes, total: t.chargesTotal }
}
