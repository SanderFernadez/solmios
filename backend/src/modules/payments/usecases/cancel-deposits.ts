// payments/usecases/cancel-deposits.ts — F5 plan #627
//
// Wrapper de DepositsUseCase.markHeldForCancellation con auditoría + sockets.
// Extraído del service para mantener PaymentsService < 200 líneas (analyzer gate).
// Molde: deposits.ts → releaseHeldByReservation (delegación con callback de audit/sockets).
//
// TODO #627: refund real de Stripe pendiente (CLAUDE.md:294) — esto solo MARCA los registros.

import type { DepositDTO } from '../types'
import type { DepositsUseCase } from './deposits'
import { depositReleaseEntry, depositRefundEntry } from './audit'

export interface CancelDepositsPort {
  deposits: DepositsUseCase
  audit: (entry: any) => Promise<void>
  sockets: {
    onDepositReleased?: (d: DepositDTO) => Promise<void>
    onDepositRefunded?: (d: DepositDTO) => Promise<void>
  }
}

/**
 * Marca/libera depósitos 'held' tras una cancelación, con audit + sockets por cada uno.
 * El cálculo de penalidad ya se hizo en cancel.ts (F2) / public-cancel.ts (F4);
 * acá solo se aplica el resultado a los depósitos.
 */
export async function cancelHeldDeposits(
  port: CancelDepositsPort,
  reservationId: string,
  refundAmount: number,
  cancellationFee: number,
): Promise<DepositDTO[]> {
  return port.deposits.markHeldForCancellation(
    reservationId,
    refundAmount,
    cancellationFee,
    async (d, action) => {
      if (action === 'released') {
        await port.audit(depositReleaseEntry(d, undefined))
        await port.sockets.onDepositReleased?.(d)
      } else {
        await port.audit(depositRefundEntry(d, undefined))
        await port.sockets.onDepositRefunded?.(d)
      }
    },
  )
}
