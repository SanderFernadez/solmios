import type { RepositoryAdapter, Logger } from 'arckode-framework'
import { AuthError } from 'arckode-framework'
import type { MessageDTO, MessageUser, Conversation, ContactDTO, UserDirectory, MessageWithSender } from './types'
import type { MessagesSockets } from './sockets'
import { TEAM_ALIAS, isTeamId, resolveRecipient, teamIdFor } from './usecases/team-channel'
import { markTeamRead, type ReadMarker } from './usecases/team-reads'
import { listConversations } from './usecases/list-conversations'

export type { MessageDTO, MessageUser, Conversation, ContactDTO, UserDirectory, MessageWithSender } from './types'

const isManager = (role: string) => role === 'hotel_admin' || role === 'super_admin'

const byCreatedAtAsc = (a: MessageDTO, b: MessageDTO) =>
  new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()

export class MessagesService {
  /** Cableado por `connectors/messages-usuarios.ts`. Ausente = el módulo degrada, no falla. */
  private directory?: UserDirectory

  private sockets: MessagesSockets = {}

  constructor(
    private readonly repo: RepositoryAdapter<MessageDTO>,
    private readonly logger: Logger,
    /** Marcas de lectura por canal. Ausente (tests) → el team no cuenta no leídos. */
    private readonly readsRepo?: RepositoryAdapter<ReadMarker>,
  ) {}

  /** El usuario abrió el grupo: baja su contador de no leídos del canal. */
  async markTeamRead(currentUser: MessageUser): Promise<void> {
    await markTeamRead(this.readsRepo, currentUser)
  }

  /**
   * Marca TODO como leído de una: los mensajes personales dirigidos al usuario
   * y el canal del equipo. Evita tener que abrir cada chat para bajar el globo.
   * Filtra `isRead` en memoria para no pasar un booleano a la query (Postgres lo
   * rechaza en columnas numéricas).
   */
  async markAllRead(currentUser: MessageUser): Promise<void> {
    const mine = await this.repo.findMany({ hotelId: currentUser.hotelId, toUserId: currentUser.id })
    for (const m of mine) {
      if (!(m as any).isRead) {
        await this.repo.update(m.id, { isRead: true } as Partial<Omit<MessageDTO, 'id'>>)
      }
    }
    await markTeamRead(this.readsRepo, currentUser)
  }

  setUserDirectory(directory: UserDirectory): void {
    this.directory = directory
  }

  // ACUMULA handlers — nunca pisa el anterior.
  setSockets(s: Partial<MessagesSockets>): void {
    const next = s as Record<string, any>
    const cur = this.sockets as Record<string, any>
    for (const key of Object.keys(next)) {
      const h = next[key]
      if (!h) continue
      const prev = cur[key]
      cur[key] = prev ? async (...a: any[]) => { await prev(...a); await h(...a) } : h
    }
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
    return listConversations(this.repo, this.directory, this.readsRepo, currentUser)
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
    const sent = await this.repo.create({
      fromUserId: currentUser.id,
      toUserId: recipient,
      message: message || '',
      photoUrl,
      isRead: false,
      hotelId: currentUser.hotelId,
    } as Omit<MessageDTO, 'id'>)

    // El aviso al teléfono es un efecto de costado: el mensaje ya está guardado.
    // Si Firebase está caído, el destinatario lo verá igual al abrir la app.
    try {
      await this.sockets.onMessageSent?.(sent)
    } catch (error) {
      this.logger.warn('El aviso del mensaje falló', { id: sent.id, error: String(error) })
    }

    return sent
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
