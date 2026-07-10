// connectors/messages-usuarios.ts — Wire: messages → usuarios
//
// El chat necesita los nombres de sus interlocutores, pero `GET /api/usuarios` exige el permiso
// `users:view`, que housekeeper/supervisor/maintenance no tienen. En vez de sobre-privilegiar esos
// roles, `messages` declara el puerto `UserDirectory` y este connector se lo cablea.
//
// Proyecta a `{id, name, role, avatar}`: un contacto del chat nunca lleva email ni teléfono.

import type { ConnectorContext } from 'arckode-framework'
import type { ContactDTO, UserDirectory } from '../modules/messages'

export function messagesUsuariosConnector(ctx: ConnectorContext): void {
  const messages = ctx.resolveModule<{ setUserDirectory: (d: UserDirectory) => void }>('messages')
  const usuarios = ctx.resolveModule<{ list: (hotelId?: string) => Promise<any[]> }>('usuarios')

  const toContact = (u: any): ContactDTO => ({
    id: String(u.id),
    name: String(u.name ?? ''),
    role: String(u.role ?? ''),
    avatar: u.avatar ? String(u.avatar) : null,
  })

  messages.setUserDirectory({
    listStaff: async (hotelId: string): Promise<ContactDTO[]> => {
      const staff = await usuarios.list(hotelId)
      return staff.map(toContact)
    },
    // Resuelve nombres por id SIN filtrar por hotel: `usuarios.list()` sin
    // argumento trae a todos, así el super_admin (que no está scopeado a ningún
    // hotel) también se resuelve y no cae a "Usuario" en la lista de chats.
    resolveNames: async (userIds: string[]): Promise<Map<string, ContactDTO>> => {
      const wanted = new Set(userIds)
      const all = await usuarios.list()
      const map = new Map<string, ContactDTO>()
      for (const u of all) {
        const id = String(u.id)
        if (wanted.has(id)) map.set(id, toContact(u))
      }
      return map
    },
  })
}
