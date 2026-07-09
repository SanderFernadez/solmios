// payments/usecases/reconciliation.ts — Bank reconciliation logic

import type { RepositoryAdapter } from 'arckode-framework'
import type { PaymentDTO, ReconciliationEntry, ReconciliationResult } from '../types'

/**
 * El WHERE del repositorio solo soporta igualdad: un `{ $gte, $lte }` se bindea crudo al driver
 * ("Binding expected string"). El rango se acota en memoria, comparando por día para que `to`
 * incluya los pagos de esa misma fecha.
 */
function inDateRange(payments: PaymentDTO[], from?: string, to?: string): PaymentDTO[] {
  if (!from && !to) return payments
  const day = (iso: string) => (iso || '').slice(0, 10)
  const gte = from ? day(from) : undefined
  const lte = to ? day(to) : undefined
  return payments.filter(p => (!gte || day(p.createdAt) >= gte) && (!lte || day(p.createdAt) <= lte))
}

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
