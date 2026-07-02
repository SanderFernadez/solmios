// cash/sockets.ts — Hooks OPCIONALES hacia otros módulos.
// Un conector (ej. payments→caja) puede pasar sockets para reaccionar a eventos de caja.

import type { CashMovementDTO, CashShiftDTO } from './types'

export interface CashSockets {
  onCashMovementCreated?: (data: CashMovementDTO) => Promise<void>
  onCashMovementUpdated?: (data: CashMovementDTO) => Promise<void>
  onCashMovementDeleted?: (id: string) => Promise<void>
  onShiftOpened?: (shift: CashShiftDTO) => Promise<void>
  onShiftClosed?: (shift: CashShiftDTO) => Promise<void>
}
