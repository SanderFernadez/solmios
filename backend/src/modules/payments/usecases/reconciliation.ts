// payments/usecases/reconciliation.ts — Bank reconciliation logic

import type { RepositoryAdapter } from 'arckode-framework'
import type { PaymentDTO, ReconciliationEntry, ReconciliationResult } from '../types'
import { inDateRange } from '../../../shared/usecases/date-range'

export class ReconciliationUseCase {
  constructor(
    private readonly paymentRepo: RepositoryAdapter<PaymentDTO>,
  ) {}

  async reconcile(hotelId: string, bankEntries?: ReconciliationEntry[], from?: string, to?: string): Promise<ReconciliationResult> {
    // Una fila sin monto numérico envenena `difference` con NaN: se descarta antes de cruzar.
    const entries = (Array.isArray(bankEntries) ? bankEntries : [])
      .filter((e): e is ReconciliationEntry => !!e && Number.isFinite(e.amount))

    const payments = inDateRange(
      await this.paymentRepo.findMany({ hotelId, status: 'completed' }),
      'createdAt',
      from,
      to,
    )

    const matched: ReconciliationResult['matched'] = []
    const unmatchedBank: ReconciliationEntry[] = []
    const unmatchedSystem: PaymentDTO[] = [...payments]

    for (const bank of entries) {
      const idx = unmatchedSystem.findIndex(p =>
        Math.abs(p.amount - Math.abs(bank.amount)) < 0.01 &&
        (!bank.reference || p.reference === bank.reference)
      )
      if (idx >= 0) {
        matched.push({ bank, system: unmatchedSystem[idx] })
        unmatchedSystem.splice(idx, 1)
      } else {
        unmatchedBank.push(bank)
      }
    }

    return {
      matched,
      unmatchedBank,
      unmatchedSystem,
      difference: entries.reduce((s, e) => s + e.amount, 0) -
        payments.reduce((s, p) => s + p.amount, 0),
    }
  }
}
