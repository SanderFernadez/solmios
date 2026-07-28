// payments/sockets.ts — Hooks hacia otros módulos

import type { PaymentDTO, PaymentLinkDTO, DepositDTO } from './types'

export interface PaymentsSockets {
  onPaymentCreated?: (data: PaymentDTO) => Promise<void>
  onPaymentCompleted?: (data: PaymentDTO) => Promise<void>
  onPaymentFailed?: (data: PaymentDTO) => Promise<void>
  onRefundProcessed?: (data: PaymentDTO) => Promise<void>
  onDepositCreated?: (data: DepositDTO) => Promise<void>
  /** Reembolso parcial/total del depósito (ver `DepositsUseCase.refund`) — distinto de `onDepositReleased`. */
  onDepositRefunded?: (data: DepositDTO) => Promise<void>
  onDepositReleased?: (data: DepositDTO) => Promise<void>
  onLinkUsed?: (data: PaymentLinkDTO) => Promise<void>
}
