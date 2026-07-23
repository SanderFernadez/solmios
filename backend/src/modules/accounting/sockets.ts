// accounting/sockets.ts — Hooks OPCIONALES hacia otros módulos.
// El módulo funciona sin ellos. Un conector puede pasar sockets para reaccionar a eventos.
import type { AccountDTO } from './types'

export interface AccountingSockets {
  onAccountCreated?: (data: AccountDTO) => Promise<void>
  onAccountUpdated?: (data: AccountDTO) => Promise<void>
  onJournalEntryPosted?: (entryId: string) => Promise<void>
}
