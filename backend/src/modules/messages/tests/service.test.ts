// messages/tests/service.test.ts — Tests del servicio de chat interno.
// Usa RepositoryAdapter mock — sin dependencia de SQLite ni Postgres.

import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { MessagesService } from '../service'
import type { MessageDTO, MessageUser, ContactDTO, UserDirectory } from '../types'

const log = silentLogger()

const me: MessageUser = { id: 'u1', hotelId: 'h1', role: 'receptionist' }
const boss: MessageUser = { id: 'u9', hotelId: 'h1', role: 'hotel_admin' }

function msg(over: Partial<MessageDTO>): MessageDTO {
  return {
    id: 'm1', fromUserId: 'u1', toUserId: 'u2', message: 'hola', photoUrl: null,
    isRead: false, hotelId: 'h1', createdAt: '2026-07-01T10:00:00Z', updatedAt: '',
    ...over,
  }
}

/** Repo que respeta los filtros exactos, como el ORM real. */
function repoWith(rows: MessageDTO[], sink: any[] = []): RepositoryAdapter<MessageDTO> {
  return {
    findMany: async (f: any) => rows.filter((r) => Object.entries(f ?? {}).every(([k, v]) => (r as any)[k] === v)),
    findById: async (id: string) => rows.find((r) => r.id === id) ?? null,
    create: async (d: any) => { const r = { id: 'new', ...d }; sink.push(r); return r },
    update: async (id: string, d: any) => { sink.push({ id, ...d }); return { ...msg({ id }), ...d } },
  } as unknown as RepositoryAdapter<MessageDTO>
}

describe('MessagesService', () => {
  it('agrupa por interlocutor y se queda con el último mensaje', async () => {
    const rows = [
      msg({ id: 'm1', fromUserId: 'u1', toUserId: 'u2', message: 'viejo', createdAt: '2026-07-01T10:00:00Z' }),
      msg({ id: 'm2', fromUserId: 'u2', toUserId: 'u1', message: 'nuevo', createdAt: '2026-07-02T10:00:00Z' }),
    ]
    const convos = await new MessagesService(repoWith(rows), log).getConversations(me)

    expect(convos).toHaveLength(1)
    expect(convos[0].userId).toBe('u2')
    expect(convos[0].lastMessage).toBe('nuevo')
    expect(convos[0].direction).toBe('received')
  })

  it('el hilo con un usuario viene en orden cronológico', async () => {
    const rows = [
      msg({ id: 'm2', fromUserId: 'u2', toUserId: 'u1', message: 'segundo', createdAt: '2026-07-02T10:00:00Z' }),
      msg({ id: 'm1', fromUserId: 'u1', toUserId: 'u2', message: 'primero', createdAt: '2026-07-01T10:00:00Z' }),
    ]
    const hilo = await new MessagesService(repoWith(rows), log).getMessagesWith('u2', me)

    expect(hilo.map((m) => m.message)).toEqual(['primero', 'segundo'])
  })

  it('un mensaje nace sin leer y con el hotel del que lo envía', async () => {
    const sink: any[] = []
    await new MessagesService(repoWith([], sink), log).sendMessage('u2', 'hola', null, me)

    expect(sink[0]).toMatchObject({ fromUserId: 'u1', toUserId: 'u2', isRead: false, hotelId: 'h1' })
  })

  it('solo el destinatario marca como leído', async () => {
    const rows = [msg({ id: 'm1', fromUserId: 'u1', toUserId: 'u2' })]
    const sink: any[] = []
    // u1 es el REMITENTE: no puede marcar leído el mensaje que él mandó
    await new MessagesService(repoWith(rows, sink), log).markAsRead('m1', me)

    expect(sink).toHaveLength(0)
  })

  it('un manager puede marcar como leído cualquier mensaje de su hotel', async () => {
    const rows = [msg({ id: 'm1', fromUserId: 'u1', toUserId: 'u2' })]
    const sink: any[] = []
    await new MessagesService(repoWith(rows, sink), log).markAsRead('m1', boss)

    expect(sink[0]).toMatchObject({ id: 'm1', isRead: true })
  })

  it('getAllConversations es solo para managers', async () => {
    const rows = [msg({})]
    const svc = new MessagesService(repoWith(rows), log)

    expect(await svc.getAllConversations(me)).toEqual([])
    expect(await svc.getAllConversations(boss)).toHaveLength(1)
  })
})

describe('MessagesService.getContacts', () => {
  /** El directorio real lo cablea `connectors/messages-usuarios.ts` desde UsuariosService.list(). */
  const directoryOf = (staff: ContactDTO[]): UserDirectory => ({
    listStaff: async (hotelId: string) => (hotelId === 'h1' ? staff : []),
  })

  const staffOfH1: ContactDTO[] = [
    { id: 'u1', name: 'Yo Mismo', role: 'receptionist', avatar: null },
    { id: 'u2', name: 'Rosa Perez', role: 'housekeeper', avatar: '/uploads/avatars/rosa.jpg' },
    { id: 'u3', name: 'Carlos Ruiz', role: 'supervisor', avatar: null },
  ]

  it('devuelve los compañeros del hotel, sin el propio usuario', async () => {
    const svc = new MessagesService(repoWith([]), log)
    svc.setUserDirectory(directoryOf(staffOfH1))

    const contacts = await svc.getContacts(me)

    expect(contacts.map((c) => c.id)).toEqual(['u2', 'u3'])
  })

  it('un contacto nunca lleva email ni teléfono', async () => {
    const svc = new MessagesService(repoWith([]), log)
    svc.setUserDirectory(directoryOf(staffOfH1))

    const [contact] = await svc.getContacts(me)

    expect(Object.keys(contact).sort()).toEqual(['avatar', 'id', 'name', 'role'])
  })

  it('solo trae staff del hotel del que pregunta', async () => {
    const svc = new MessagesService(repoWith([]), log)
    svc.setUserDirectory(directoryOf(staffOfH1))

    const otherHotel: MessageUser = { id: 'u1', hotelId: 'h2', role: 'housekeeper' }

    expect(await svc.getContacts(otherHotel)).toEqual([])
  })

  it('degrada a lista vacía si el connector no cableó el directorio', async () => {
    const svc = new MessagesService(repoWith([]), log)

    expect(await svc.getContacts(me)).toEqual([])
  })
})

describe('MessagesService — canal del equipo', () => {
  const directory: UserDirectory = {
    listStaff: async () => [
      { id: 'u1', name: 'Yo Mismo', role: 'receptionist', avatar: null },
      { id: 'u2', name: 'Rosa Perez', role: 'housekeeper', avatar: '/uploads/a.jpg' },
    ],
  }

  const withDirectory = (rows: MessageDTO[], sink: any[] = []) => {
    const svc = new MessagesService(repoWith(rows, sink), log)
    svc.setUserDirectory(directory)
    return svc
  }

  it('el alias "team" se persiste como team:<hotelId> del token', async () => {
    const sink: any[] = []
    await withDirectory([], sink).sendMessage('team', 'hola equipo', null, me)

    expect(sink[0].toUserId).toBe('team:h1')
    expect(sink[0].hotelId).toBe('h1')
  })

  // Sin esto, mandar toUserId:'team:h2' escribiría en el grupo de otro hotel.
  it('rechaza un id de equipo explícito venido del cliente', async () => {
    const svc = withDirectory([])

    expect(svc.sendMessage('team:h2', 'intruso', null, me)).rejects.toThrow()
  })

  it('lee el canal del equipo y adjunta el remitente de cada mensaje', async () => {
    const rows = [
      msg({ id: 'm1', fromUserId: 'u2', toUserId: 'team:h1', message: 'del equipo' }),
      msg({ id: 'm2', fromUserId: 'u1', toUserId: 'u2', message: 'privado' }),
    ]
    const thread = await withDirectory(rows).getMessagesWith('team', me)

    expect(thread).toHaveLength(1)
    expect(thread[0].message).toBe('del equipo')
    expect(thread[0].senderName).toBe('Rosa Perez')
    expect(thread[0].senderAvatar).toBe('/uploads/a.jpg')
  })

  it('el canal de otro hotel no se filtra en el propio', async () => {
    const rows = [msg({ id: 'm1', fromUserId: 'u2', toUserId: 'team:h2', hotelId: 'h2' })]

    expect(await withDirectory(rows).getMessagesWith('team', me)).toEqual([])
  })

  it('el equipo va primero en la lista y no se mezcla con los chats personales', async () => {
    const rows = [
      msg({ id: 'm1', fromUserId: 'u1', toUserId: 'u2', message: 'privado', createdAt: '2026-07-03T10:00:00Z' }),
      msg({ id: 'm2', fromUserId: 'u2', toUserId: 'team:h1', message: 'grupal', createdAt: '2026-07-02T10:00:00Z' }),
    ]
    const convos = await withDirectory(rows).getConversations(me)

    expect(convos[0].isTeam).toBe(true)
    expect(convos[0].userId).toBe('team')
    expect(convos[0].lastSenderName).toBe('Rosa Perez')
    // El chat con u2 sigue siendo uno solo, sin el mensaje grupal adentro.
    expect(convos.filter((c) => !c.isTeam).map((c) => c.userId)).toEqual(['u2'])
  })

  it('sin mensajes del equipo, la lista no inventa el canal', async () => {
    const rows = [msg({ id: 'm1', fromUserId: 'u1', toUserId: 'u2' })]
    const convos = await withDirectory(rows).getConversations(me)

    expect(convos.some((c) => c.isTeam)).toBe(false)
  })

  it('marcar leído no cruza hoteles', async () => {
    const sink: any[] = []
    const rows = [msg({ id: 'm1', toUserId: 'u9', hotelId: 'h2' })]
    await withDirectory(rows, sink).markAsRead('m1', boss)

    expect(sink).toEqual([])
  })
})
