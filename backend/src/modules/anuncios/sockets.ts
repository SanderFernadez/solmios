// anuncios/sockets.ts — Hooks OPCIONALES hacia otros módulos
// Los sockets son opcionales. El módulo funciona sin ellos.
// Un conector puede pasar sockets para reaccionar a eventos del módulo.

import type { AnunciosDTO } from './types'

export interface AnunciosSockets {
  onAnunciosCreated?: (data: AnunciosDTO) => Promise<void>
  onAnunciosUpdated?: (data: AnunciosDTO) => Promise<void>
  onAnunciosDeleted?: (id: string) => Promise<void>
}
