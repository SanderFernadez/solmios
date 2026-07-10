// connectors/pushtokens-usuarios.ts — Wire: pushtokens → usuarios
//
// El aviso que llega al teléfono dice "Rosa: llegué al 302", no el id de Rosa.
// `pushtokens` declara el puerto `StaffDirectory` y acá se le cablea `usuarios`.

import type { ConnectorContext } from 'arckode-framework'
import type { StaffDirectory } from '../modules/pushtokens'

export function pushtokensUsuariosConnector(ctx: ConnectorContext): void {
  const push = ctx.resolveModule<{ setStaffDirectory: (d: StaffDirectory) => void }>('pushtokens')
  const usuarios = ctx.resolveModule<{ list: (hotelId?: string) => Promise<any[]> }>('usuarios')
  if (!push || !usuarios) return

  push.setStaffDirectory({
    nameOf: async (hotelId: string, userId: string): Promise<string> => {
      const staff = await usuarios.list(hotelId)
      const person = staff.find((u) => String(u.id) === userId)
      return person ? String(person.name ?? '') : ''
    },
  })
}
