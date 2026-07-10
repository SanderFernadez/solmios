import type { RepositoryAdapter, Logger } from 'arckode-framework'
import { AuthError } from 'arckode-framework'
import type { MessageDTO, MessageUser, Conversation, ContactDTO, UserDirectory, MessageWithSender } from './types'
import { TEAM_ALIAS, isTeamId, resolveRecipient, teamIdFor } from './usecases/team-channel'

export type { MessageDTO, MessageUser, Conversation, ContactDTO, UserDirectory, MessageWithSender } from './types'

const isManager = (role: string) => role === 'hotel_admin' || role === 'super_admin'

const byCreatedAtAsc = (a: MessageDTO, b: MessageDTO) =>
  new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()

export class MessagesService {
  /** Cableado por `connectors/messages-usuarios.ts`. Ausente = el módulo degrada, no falla. */
  private directory?: UserDirectory

  constructor(
    private readonly repo: RepositoryAdapter<MessageDTO>,
    private readonly logger: Logger,
  ) {}

  setUserDirectory(directory: UserDirectory): void {
    this.directory = directory
  }

  /** Compañeros del hotel a los que se les puede escribir. Excluye al propio usuario. */
  async getContacts(currentUser: MessageUser): Promise<ContactDTO[]> {
    if (!this.directory) {
      this.logger.warn('getContacts sin UserDirectory cableado — revisar connector messages-usuarios')
      return []
    }
    const staff = await this.directory.listStaff(currentUser.hotelId)
    return staff.filter((u) => u.id !== currentUser.id)
  }

  /** Índice id → contacto, para resolver el remitente de cada mensaje. */
  private async staffById(hotelId: string): Promise<Map<string, ContactDTO>> {
    if (!this.directory) return new Map()
    const staff = await this.directory.listStaff(hotelId)
    return new Map(staff.map((u) => [u.id, u]))
  }

  /** Agrega nombre/foto/cargo del remitente. Campos de lectura: jamás van a `create`. */
  private withSenders(messages: MessageDTO[], staff: Map<string, ContactDTO>): MessageWithSender[] {
    return messages.map((msg) => {
      const sender = staff.get(msg.fromUserId)
      return {
        ...msg,
        senderName: sender?.name ?? '',
        senderAvatar: sender?.avatar ?? null,
        senderRole: sender?.role ?? '',
      }
    })
  }

  /** Última conversación por interlocutor, más el canal del equipo si tiene mensajes. */
  async getConversations(currentUser: MessageUser): Promise<Conversation[]> {
    const teamId = teamIdFor(currentUser.hotelId)
    const [sent, received, team] = await Promise.all([
      this.repo.findMany({ hotelId: currentUser.hotelId, fromUserId: currentUser.id }),
      this.repo.findMany({ hotelId: currentUser.hotelId, toUserId: currentUser.id }),
      this.repo.findMany({ hotelId: currentUser.hotelId, toUserId: teamId }),
    ])

    const byUser = new Map<string, MessageDTO>()
    // Los que yo mandé al equipo salen en `sent`: agruparlos por interlocutor los
    // mezclaría con los chats personales.
    for (const msg of [...sent.filter((m) => !isTeamId(m.toUserId)), ...received]) {
      const otherId = msg.fromUserId === currentUser.id ? msg.toUserId : msg.fromUserId
      const existing = byUser.get(otherId)
      if (!existing || new Date(msg.createdAt) > new Date(existing.createdAt)) byUser.set(otherId, msg)
    }

    // Los pendientes son los que me mandaron y no abrí, contados uno por uno.
    // `received` ya está en memoria: contarlos acá no cuesta una query más.
    const unreadByUser = new Map<string, number>()
    for (const msg of received) {
      if (msg.isRead) continue
      unreadByUser.set(msg.fromUserId, (unreadByUser.get(msg.fromUserId) ?? 0) + 1)
    }

    const direct: Conversation[] = Array.from(byUser.entries()).map(([userId, lastMsg]) => ({
      userId,
      lastMessage: lastMsg.message,
      lastPhoto: lastMsg.photoUrl,
      lastTime: lastMsg.createdAt,
      isRead: lastMsg.isRead,
      direction: lastMsg.fromUserId === currentUser.id ? 'sent' : 'received',
      unreadCount: unreadByUser.get(userId) ?? 0,
    }))

    if (team.length === 0) return direct

    const lastTeam = [...team].sort(byCreatedAtAsc).at(-1)!
    const staff = await this.staffById(currentUser.hotelId)
    return [
      {
        userId: TEAM_ALIAS,
        lastMessage: lastTeam.message,
        lastPhoto: lastTeam.photoUrl,
        lastTime: lastTeam.createdAt,
        // El canal del equipo no lleva acuse de lectura: marcarlo "no leído" para
        // siempre dejaría un badge permanente que nadie puede apagar. Por lo
        // mismo no aporta pendientes al contador.
        isRead: true,
        unreadCount: 0,
        direction: lastTeam.fromUserId === currentUser.id ? 'sent' : 'received',
        isTeam: true,
        lastSenderName: staff.get(lastTeam.fromUserId)?.name ?? '',
      },
      ...direct,
    ]
  }

  /**
   * Hilo completo, en orden cronológico.
   *
   * `peerId === 'team'` devuelve el canal del equipo del hotel del usuario. El
   * hotelId sale del token, nunca del cliente.
   */
  async getMessagesWith(peerId: string, currentUser: MessageUser): Promise<MessageWithSender[]> {
    const staff = await this.staffById(currentUser.hotelId)

    if (peerId === TEAM_ALIAS) {
      const team = await this.repo.findMany({
        hotelId: currentUser.hotelId,
        toUserId: teamIdFor(currentUser.hotelId),
      })
      return this.withSenders([...team].sort(byCreatedAtAsc), staff)
    }

    const [sent, received] = await Promise.all([
      this.repo.findMany({ hotelId: currentUser.hotelId, fromUserId: currentUser.id, toUserId: peerId }),
      this.repo.findMany({ hotelId: currentUser.hotelId, fromUserId: peerId, toUserId: currentUser.id }),
    ])
    return this.withSenders([...sent, ...received].sort(byCreatedAtAsc), staff)
  }

  async sendMessage(toUserId: string, message: string, photoUrl: string | null, currentUser: MessageUser): Promise<MessageDTO> {
    // `team` → `team:<hotelId del token>`. Un id de equipo explícito viniendo del
    // cliente sería la única vía para escribir en el grupo de otro hotel.
    if (isTeamId(toUserId)) throw new AuthError('Para escribirle al equipo usá toUserId: "team"')
    const recipient = resolveRecipient(toUserId, currentUser.hotelId)

    this.logger.info('Enviando mensaje', { from: currentUser.id, to: recipient, hasPhoto: Boolean(photoUrl) })
    return this.repo.create({
      fromUserId: currentUser.id,
      toUserId: recipient,
      message: message || '',
      photoUrl,
      isRead: false,
      hotelId: currentUser.hotelId,
    } as Omit<MessageDTO, 'id'>)
  }

  /** Solo el destinatario (o un manager) puede marcar como leído. */
  async markAsRead(messageId: string, currentUser: MessageUser): Promise<void> {
    const msg = await this.repo.findById(messageId)
    if (!msg) return
    if (msg.hotelId !== currentUser.hotelId) return
    if (msg.toUserId !== currentUser.id && !isManager(currentUser.role)) return
    await this.repo.update(messageId, { isRead: true } as Partial<Omit<MessageDTO, 'id'>>)
  }

  async getAllConversations(currentUser: MessageUser): Promise<MessageDTO[]> {
    if (!isManager(currentUser.role)) return []
    return this.repo.findMany({ hotelId: currentUser.hotelId })
  }
}
