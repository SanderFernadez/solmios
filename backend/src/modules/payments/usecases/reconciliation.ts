// payments/usecases/reconciliation.ts — Bank reconciliation logic

import type { RepositoryAdapter } from 'arckode-framework'
import type { PaymentDTO, ReconciliationEntry, ReconciliationResult } from '../types'

export class ReconciliationUseCase {
  constructor(
    private readonly paymentRepo: RepositoryAdapter<PaymentDTO>,
  ) {}

  async reconcile(hotelId: string, bankEntries: ReconciliationEntry[], from?: string, to?: string): Promise<ReconciliationResult> {
    const filters: Record<string, any> = { hotelId, status: 'completed' }
    if (from && to) {
      filters.createdAt = { $gte: from, $lte: to }
    }

    const payments = await this.paymentRepo.findMany(filters)

    const matched: ReconciliationResult['matched'] = []
    const unmatchedBank: ReconciliationEntry[] = [...bankEntries]
    const unmatchedSystem: PaymentDTO[] = [...payments]

    for (const bank of bankEntries) {
      const idx = unmatchedSystem.findIndex(p =>
        Math.abs(p.amount - Math.abs(bank.amount)) < 0.01 &&
        (!bank.reference || p.reference === bank.reference)
      )
      if (idx >= 0) {
        matched.push({ bank, system: unmatchedSystem[idx] })
        unmatchedSystem.splice(idx, 1)
        const bankIdx = unmatchedBank.indexOf(bank)
        if (bankIdx >= 0) unmatchedBank.splice(bankIdx, 1)
      }
    }

    return {
      matched,
      unmatchedBank,
      unmatchedSystem,
      difference: bankEntries.reduce((s, e) => s + e.amount, 0) -
        payments.reduce((s, p) => s + p.amount, 0),
    }
  }
}
