import type { RepositoryAdapter, Logger } from 'arckode-framework'

export interface MessageDTO {
  id: string
  fromuserid: string
  touserid: string
  message: string
  photourl: string | null
  isread: number
  hotelid: string
  createdat: string
  updatedat: string
}

export interface MessageUser {
  id: string
  hotelId: string
  role: string
}

export class MessagesService {
  constructor(
    private readonly repo: RepositoryAdapter<MessageDTO>,
    private readonly logger: Logger,
  ) {}

  async getConversations(currentUser: MessageUser): Promise<any[]> {
    const [sent, received] = await Promise.all([
      this.repo.findAll({ hotelid: currentUser.hotelId, fromuserid: currentUser.id }),
      this.repo.findAll({ hotelid: currentUser.hotelId, touserid: currentUser.id }),
    ])

    const allMessages = [...(sent.data || []), ...(received.data || [])]
    const byUser = new Map<string, MessageDTO>()

    for (const msg of allMessages) {
      const otherId = msg.fromuserid === currentUser.id ? msg.touserid : msg.fromuserid
      const existing = byUser.get(otherId)
      if (!existing || new Date(msg.createdat) > new Date(existing.createdat)) {
        byUser.set(otherId, msg)
      }
    }

    return Array.from(byUser.entries()).map(([userId, lastMsg]) => ({
      userId,
      lastMessage: lastMsg.message,
      lastPhoto: lastMsg.photourl,
      lastTime: lastMsg.createdat,
      isRead: lastMsg.isread,
      direction: lastMsg.fromuserid === currentUser.id ? 'sent' : 'received',
    }))
  }

  async getMessagesWith(userId: string, currentUser: MessageUser): Promise<MessageDTO[]> {
    const [sent, received] = await Promise.all([
      this.repo.findAll({ hotelid: currentUser.hotelId, fromuserid: currentUser.id, touserid: userId }),
      this.repo.findAll({ hotelid: currentUser.hotelId, fromuserid: userId, touserid: currentUser.id }),
    ])

    const all = [...(sent.data || []), ...(received.data || [])]
    all.sort((a, b) => new Date(a.createdat).getTime() - new Date(b.createdat).getTime())
    return all
  }

  async sendMessage(toUserId: string, message: string, photoUrl: string | null, currentUser: MessageUser): Promise<MessageDTO> {
    const item = await this.repo.create({
      fromuserid: currentUser.id,
      touserid: toUserId,
      message: message || '',
      photourl: photoUrl,
      isread: 0,
      hotelid: currentUser.hotelId,
    } as any)
    return item
  }

  async markAsRead(messageId: string, currentUser: MessageUser): Promise<void> {
    const msg = await this.repo.findById(messageId)
    if (!msg) return
    if (msg.touserid !== currentUser.id && currentUser.role !== 'hotel_admin' && currentUser.role !== 'super_admin') return
    await this.repo.update(messageId, { isread: 1 } as any)
  }

  async getAllConversations(currentUser: MessageUser): Promise<any[]> {
    if (currentUser.role !== 'hotel_admin' && currentUser.role !== 'super_admin') {
      return []
    }
    const result = await this.repo.findAll({ hotelid: currentUser.hotelId })
    return result.data || []
  }
}
