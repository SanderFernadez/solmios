// hotelmedia/sockets.ts — Hooks OPCIONALES hacia otros módulos.
// Por ahora no se emiten eventos (la spec F0 no los requiere). Se deja la interfaz
// vacía para que el service pueda invocar `await this.sockets.onX?.(...)` sin romper
// cuando un conector futuro quiera reaccionar a altas/bajas de media.
import type { HotelMediaDTO } from './types'

export interface HotelMediaSockets {
  onHotelMediaCreated?: (data: HotelMediaDTO) => Promise<void>
  onHotelMediaUpdated?: (data: HotelMediaDTO) => Promise<void>
  onHotelMediaRemoved?: (id: string) => Promise<void>
}
