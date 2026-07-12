// reembolsos/sockets.ts — Hooks OPCIONALES hacia otros módulos.
// Un conector puede escuchar `onClaimPaid` para asentar el egreso en caja (pago en efectivo).

import type { ExpenseClaimDTO } from './types'

export interface ReembolsosSockets {
  onClaimSubmitted?: (data: ExpenseClaimDTO) => Promise<void>
  onClaimApproved?: (data: ExpenseClaimDTO) => Promise<void>
  onClaimPaid?: (data: ExpenseClaimDTO) => Promise<void>
}
