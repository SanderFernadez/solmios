import type { HttpRequest } from 'arckode-framework'
import type { MessagesService } from './service'

export class MessagesController {
  constructor(private readonly service: MessagesService) {}

  async conversations(req: HttpRequest) {
    const user = req.user as any
    const result = await this.service.getConversations(user)
    return { status: 200, body: { success: true, data: result } }
  }

  async messagesWith(req: HttpRequest) {
    const user = req.user as any
    const result = await this.service.getMessagesWith(req.params.userId, user)
    return { status: 200, body: { success: true, data: result } }
  }

  async send(req: HttpRequest) {
    const user = req.user as any
    const { toUserId, message, photoUrl } = req.body || {}
    if (!toUserId) return { status: 400, body: { success: false, error: { message: 'toUserId is required' } } }
    const item = await this.service.sendMessage(toUserId, message || '', photoUrl || null, user)
    return { status: 201, body: { success: true, data: item } }
  }

  async markRead(req: HttpRequest) {
    const user = req.user as any
    await this.service.markAsRead(req.params.id, user)
    return { status: 200, body: { success: true, data: { message: 'Marcado como leído' } } }
  }

  async allConversations(req: HttpRequest) {
    const user = req.user as any
    const result = await this.service.getAllConversations(user)
    return { status: 200, body: { success: true, data: result } }
  }
}
