// connectors/messages-usuarios.ts — Wire: messages → usuarios
//
// El chat necesita los nombres de sus interlocutores, pero `GET /api/usuarios` exige el permiso
// `users:view`, que housekeeper/supervisor/maintenance no tienen. En vez de sobre-privilegiar esos
// roles, `messages` declara el puerto `UserDirectory` y este connector se lo cablea.
//
// Proyecta a `{id, name, role}`: un contacto del chat nunca lleva email ni teléfono.

import type { ConnectorContext } from 'arckode-framework'
import type { ContactDTO, UserDirectory } from '../modules/messages'

export function messagesUsuariosConnector(ctx: ConnectorContext): void {
  const messages = ctx.resolveModule<{ setUserDirectory: (d: UserDirectory) => void }>('messages')
  const usuarios = ctx.resolveModule<{ list: (hotelId?: string) => Promise<any[]> }>('usuarios')

  messages.setUserDirectory({
    listStaff: async (hotelId: string): Promise<ContactDTO[]> => {
      const staff = await usuarios.list(hotelId)
      return staff.map((u) => ({ id: String(u.id), name: String(u.name ?? ''), role: String(u.role ?? '') }))
    },
  })
}
