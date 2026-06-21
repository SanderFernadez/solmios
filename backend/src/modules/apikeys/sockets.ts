// apikeys/sockets.ts — Hooks OPCIONALES hacia otros módulos
// Los sockets son opcionales. El módulo funciona sin ellos.
// Un conector puede pasar sockets para reaccionar a eventos del módulo.

import type { ApikeysDTO } from './types'

export interface ApikeysSockets {
  onApikeysCreated?: (data: ApikeysDTO) => Promise<void>
  onApikeysUpdated?: (data: ApikeysDTO) => Promise<void>
  onApikeysDeleted?: (id: string) => Promise<void>
}
