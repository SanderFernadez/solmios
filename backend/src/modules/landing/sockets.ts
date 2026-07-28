// landing/sockets.ts — Hooks OPCIONALES hacia otros módulos (F1).
// El módulo landing_blocks no emite eventos hoy (la landing pública es read-only desde
// el punto de vista del huésped; los cambios los hace el admin del hotel). Si un conector
// futuro necesita reaccionar a cambios (ej. invalidar cache de sitemap al reordenar),
// se engancha acá.
import type { LandingBlockDTO } from './types'

export interface LandingSockets {
  onLandingBlockUpserted?: (hotelId: string, blocks: LandingBlockDTO[]) => Promise<void>
  onLandingBlockToggled?: (block: LandingBlockDTO) => Promise<void>
}
