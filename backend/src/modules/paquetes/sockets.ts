// paquetes/sockets.ts — Hooks OPCIONALES hacia otros módulos
// Los sockets son opcionales. El módulo funciona sin ellos.
// Un conector puede pasar sockets para reaccionar a eventos del módulo.

import type { PaquetesDTO } from './types'

export interface PaquetesSockets {
  onPaquetesCreated?: (data: PaquetesDTO) => Promise<void>
  onPaquetesUpdated?: (data: PaquetesDTO) => Promise<void>
  onPaquetesDeleted?: (id: string) => Promise<void>
}
