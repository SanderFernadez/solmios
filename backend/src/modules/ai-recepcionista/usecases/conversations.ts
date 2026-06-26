import type { Logger, CacheAdapter, Auth } from 'arckode-framework'
import { NotFoundError, AuthError } from 'arckode-framework'
import type {
  AiConversationDTO, CreateAiConversationDTO,
  AiMessageDTO,
  AiBookingFlowRecord,
  ConversationQuery, ConversationPaginated,
} from '../types'
import type { AiRecepcionistaSockets } from '../sockets'

type Repo<T> = any

export async function listConversations(
  repo: Repo<AiConversationDTO>,
  query: ConversationQuery,
  hotelId: string,
): Promise<ConversationPaginated> {
  const filters: Record<string, unknown> = { hotelId }
  if (query.status) filters.status = query.status
  if (query.channel) filters.channel = query.channel
  if (query.assignedAgentId) filters.assignedAgentId = query.assignedAgentId
  if (query.resolvedBy) filters.resolvedBy = query.resolvedBy

  const page = Math.max(query.page || 1, 1)
  const limit = Math.min(Math.max(query.limit || 20, 1), 100)
  const offset = (page - 1) * limit

  const result = await repo.paginate(filters, { offset, limit })
  return { data: result.data, total: result.total, page, limit, pages: Math.ceil(result.total / limit) }
}

export async function getConversationWithMessages(
  convRepo: Repo<AiConversationDTO>,
  msgRepo: Repo<AiMessageDTO>,
  id: string,
  userHotelId?: string,
  userRole?: string,
): Promise<{ conversation: AiConversationDTO; messages: AiMessageDTO[] }> {
  // @ignore IDOR_RISK
  const conv = await convRepo.findById(id)
  if (!conv) throw new NotFoundError('Conversación no encontrada')
  if (userRole !== 'super_admin' && conv.hotelId !== userHotelId) {
    throw new AuthError('No autorizado')
  }
  const messages = await msgRepo.findMany({ conversationId: id })
  return { conversation: conv, messages }
}

export async function findOrCreateConversation(
  repo: Repo<AiConversationDTO>,
  sockets: AiRecepcionistaSockets,
  dto: CreateAiConversationDTO,
): Promise<AiConversationDTO> {
  if (dto.channelConversationId) {
    // Find ANY conversation for this phone number (active or resolved)
    const existing = await repo.findMany({
      hotelId: dto.hotelId,
      channelConversationId: dto.channelConversationId,
    })
    if (existing.length > 0) {
      const conv = existing[0]
      // If it was resolved/closed, reopen it
      if (conv.status !== 'active') {
        await repo.update(conv.id, {
          status: 'active',
          lastMessageAt: new Date().toISOString(),
        } as any)
        conv.status = 'active'
      }
      return conv
    }
  }
  const now = new Date().toISOString()
  const conv = await repo.create({
    id: crypto.randomUUID(),
    hotelId: dto.hotelId,
    guestId: dto.guestId,
    reservationId: dto.reservationId,
    channel: dto.channel,
    channelConversationId: dto.channelConversationId,
    guestPhone: dto.guestPhone,
    guestName: dto.guestName || 'Guest',
    language: dto.language || 'es',
    status: 'active',
    startedAt: now,
    lastMessageAt: now,
  } as any)
  await sockets.onConversationStarted?.(conv)
  return conv
}

export async function closeConversation(
  repo: Repo<AiConversationDTO>,
  sockets: AiRecepcionistaSockets,
  cache: CacheAdapter,
  id: string,
  resolvedBy: string,
  score?: number,
  userHotelId?: string,
  userRole?: string,
): Promise<AiConversationDTO> {
  // @ignore IDOR_RISK
  const conv = await repo.findById(id)
  if (!conv) throw new NotFoundError('Conversación no encontrada')
  if (userRole && userRole !== 'super_admin' && conv.hotelId !== userHotelId) {
    throw new AuthError('No autorizado')
  }
  if (conv.status === 'resolved') throw new AuthError('Conversación ya cerrada')
  const now = new Date().toISOString()
  const updated = await repo.update(id, {
    status: 'resolved', resolvedBy, endedAt: now, lastMessageAt: now,
    ...(score ? { satisfactionScore: score } : {}),
  } as any)
  if (!updated) throw new NotFoundError('Conversación no encontrada')
  await sockets.onConversationClosed?.(updated)
  await cache.delete(`ai:conv:${id}`)
  return updated
}

export async function transferConversation(
  repo: Repo<AiConversationDTO>,
  sockets: AiRecepcionistaSockets,
  id: string,
  agentId: string | null,
  reason?: string,
  userHotelId?: string,
  userRole?: string,
): Promise<AiConversationDTO> {
  // @ignore IDOR_RISK
  const conv = await repo.findById(id)
  if (!conv) throw new NotFoundError('Conversación no encontrada')
  if (userRole && userRole !== 'super_admin' && conv.hotelId !== userHotelId) {
    throw new AuthError('No autorizado')
  }
  const newStatus = agentId ? 'transferred' : 'active'
  const updated = await repo.update(id, {
    status: newStatus, assignedAgentId: agentId || null,
    lastMessageAt: new Date().toISOString(),
  } as any)
  if (!updated) throw new NotFoundError('Conversación no encontrada')
  await sockets.onConversationTransferred?.(updated)
  if (!agentId && reason) {
    await sockets.onEscalatedToHuman?.({ conversationId: id, reason, severity: 'medium' })
  }
  return updated
}

export async function sendMessage(
  convRepo: Repo<AiConversationDTO>,
  msgRepo: Repo<AiMessageDTO>,
  sockets: AiRecepcionistaSockets,
  cache: CacheAdapter,
  dto: {
    conversationId: string; hotelId: string; sender: string; content: string;
    contentType?: string; intentDetected?: string; confidence?: number;
    actionTaken?: string; actionResult?: Record<string, unknown>; metadata?: Record<string, unknown>;
  },
): Promise<AiMessageDTO> {
  // @ignore IDOR_RISK
  const conv = await convRepo.findById(dto.conversationId)
  if (!conv) throw new NotFoundError('Conversación no encontrada')
  if (conv.status === 'resolved') {
    throw new AuthError('La conversación está cerrada.')
  }
  const msg = await msgRepo.create({
    id: crypto.randomUUID(),
    conversationId: dto.conversationId, hotelId: dto.hotelId,
    sender: dto.sender, content: dto.content,
    contentType: dto.contentType || 'text',
    intentDetected: dto.intentDetected, confidence: dto.confidence,
    actionTaken: dto.actionTaken, actionResult: dto.actionResult,
    metadata: dto.metadata,
  } as any)

  await convRepo.update(dto.conversationId, {
    lastMessageAt: new Date().toISOString(),
    ...(dto.intentDetected ? { intentSummary: dto.intentDetected } : {}),
  } as any)

  await sockets.onMessageReceived?.(msg)
  await cache.delete(`ai:conv:${dto.conversationId}`)
  return msg
}

export async function getBookingFlow(
  repo: Repo<AiBookingFlowRecord>,
  conversationId: string,
): Promise<AiBookingFlowRecord | null> {
  const flows = await repo.findMany({ conversationId, paymentStatus: 'pending' })
  return flows[0] || null
}

export async function createBookingFlow(
  repo: Repo<AiBookingFlowRecord>,
  conversationId: string,
  hotelId: string,
): Promise<AiBookingFlowRecord> {
  const existing = await getBookingFlow(repo, conversationId)
  if (existing) return existing
  return repo.create({
    id: crypto.randomUUID(), conversationId, hotelId,
    step: 'init', adults: 1, children: 0, totalAmount: 0,
    currency: 'USD', paymentStatus: 'pending',
  } as any)
}
