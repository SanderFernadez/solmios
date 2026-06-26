import type { AiConversationDTO, AiMessageDTO } from './types'

export interface AiRecepcionistaSockets {
  onConversationStarted?: (conv: AiConversationDTO) => Promise<void>
  onMessageReceived?: (msg: AiMessageDTO) => Promise<void>
  onBotReplied?: (msg: AiMessageDTO) => Promise<void>
  onConversationTransferred?: (conv: AiConversationDTO) => Promise<void>
  onConversationClosed?: (conv: AiConversationDTO) => Promise<void>
  onIncidentRegistered?: (data: { conversationId: string; incidentId: string; type: string }) => Promise<void>
  onBookingCreated?: (data: { conversationId: string; reservationId: string }) => Promise<void>
  onPaymentRequested?: (data: { conversationId: string; paymentLinkId: string }) => Promise<void>
  onEscalatedToHuman?: (data: { conversationId: string; reason: string; severity: string }) => Promise<void>
}
