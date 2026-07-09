import type { RepositoryAdapter, Logger } from 'arckode-framework'
import type { MessageDTO, MessageUser, Conversation } from './types'

export type { MessageDTO, MessageUser, Conversation } from './types'

const isManager = (role: string) => role === 'hotel_admin' || role === 'super_admin'

export class MessagesService {
  constructor(
    private readonly repo: RepositoryAdapter<MessageDTO>,
    private readonly logger: Logger,
  ) {}

  /** Última conversación por interlocutor. */
  async getConversations(currentUser: MessageUser): Promise<Conversation[]> {
    const [sent, received] = await Promise.all([
      this.repo.findMany({ hotelId: currentUser.hotelId, fromUserId: currentUser.id }),
      this.repo.findMany({ hotelId: currentUser.hotelId, toUserId: currentUser.id }),
    ])

    const byUser = new Map<string, MessageDTO>()
    for (const msg of [...sent, ...received]) {
      const otherId = msg.fromUserId === currentUser.id ? msg.toUserId : msg.fromUserId
      const existing = byUser.get(otherId)
      if (!existing || new Date(msg.createdAt) > new Date(existing.createdAt)) byUser.set(otherId, msg)
    }

    return Array.from(byUser.entries()).map(([userId, lastMsg]) => ({
      userId,
      lastMessage: lastMsg.message,
      lastPhoto: lastMsg.photoUrl,
      lastTime: lastMsg.createdAt,
      isRead: lastMsg.isRead,
      direction: lastMsg.fromUserId === currentUser.id ? 'sent' : 'received',
    }))
  }

  /** Hilo completo con un interlocutor, en orden cronológico. */
  async getMessagesWith(userId: string, currentUser: MessageUser): Promise<MessageDTO[]> {
    const [sent, received] = await Promise.all([
      this.repo.findMany({ hotelId: currentUser.hotelId, fromUserId: currentUser.id, toUserId: userId }),
      this.repo.findMany({ hotelId: currentUser.hotelId, fromUserId: userId, toUserId: currentUser.id }),
    ])
    return [...sent, ...received].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )
  }

  async sendMessage(toUserId: string, message: string, photoUrl: string | null, currentUser: MessageUser): Promise<MessageDTO> {
    this.logger.info('Enviando mensaje', { from: currentUser.id, to: toUserId, hasPhoto: Boolean(photoUrl) })
    return this.repo.create({
      fromUserId: currentUser.id,
      toUserId,
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
    if (msg.toUserId !== currentUser.id && !isManager(currentUser.role)) return
    await this.repo.update(messageId, { isRead: true } as Partial<Omit<MessageDTO, 'id'>>)
  }

  async getAllConversations(currentUser: MessageUser): Promise<MessageDTO[]> {
    if (!isManager(currentUser.role)) return []
    return this.repo.findMany({ hotelId: currentUser.hotelId })
  }
}
