// dispositivos/sockets.ts — Hooks OPCIONALES hacia otros módulos
// Los sockets son opcionales. El módulo funciona sin ellos.
// Un conector puede pasar sockets para reaccionar a eventos del módulo.

import type { DispositivosDTO } from './types'

export interface DispositivosSockets {
  onDispositivosCreated?: (data: DispositivosDTO) => Promise<void>
  onDispositivosUpdated?: (data: DispositivosDTO) => Promise<void>
  onDispositivosDeleted?: (id: string) => Promise<void>
}
