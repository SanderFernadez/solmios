// caja-chica/sockets.ts — Hooks OPCIONALES hacia otros módulos.
// Los sockets son opcionales. El módulo funciona sin ellos.
// Un conector puede pasar sockets para reaccionar a eventos del módulo (ninguno en v1).

import type { PettyCashFundDTO } from './types'

export interface CajaChicaSockets {
  onFundCreated?: (data: PettyCashFundDTO) => Promise<void>
  onFundUpdated?: (data: PettyCashFundDTO) => Promise<void>
  onFundDeleted?: (id: string) => Promise<void>
}
