// usuarios/sockets.ts — Eventos de autenticación

import type { UsuarioDTO } from './types'

export interface UsuarioSockets {
  onUsuarioRegistrado?: (usuario: UsuarioDTO) => Promise<void>
  onUsuarioLogin?: (usuario: UsuarioDTO) => Promise<void>
  onUsuarioEliminado?: (id: string) => Promise<void>
}
