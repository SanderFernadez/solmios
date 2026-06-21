// canales/sockets.ts — Hooks OPCIONALES hacia otros módulos
// Los sockets son opcionales. El módulo funciona sin ellos.
// Un conector puede pasar sockets para reaccionar a eventos del módulo.

import type { CanalesDTO } from './types'

export interface CanalesSockets {
  onCanalesCreated?: (data: CanalesDTO) => Promise<void>
  onCanalesUpdated?: (data: CanalesDTO) => Promise<void>
  onCanalesDeleted?: (id: string) => Promise<void>
}
