// cancellation/sockets.ts — Hooks OPCIONALES hacia otros módulos (F1 plan #627).
// Opcionales: el módulo funciona sin ellos. Un conector (F5) puede pasar sockets
// para reaccionar a eventos de creación/actualización/borrado de políticas.
import type { CancellationPolicyDTO } from './types'

export interface CancellationSockets {
  onCancellationCreated?: (data: CancellationPolicyDTO) => Promise<void>
  onCancellationUpdated?: (data: CancellationPolicyDTO) => Promise<void>
  onCancellationDeleted?: (id: string) => Promise<void>
}
