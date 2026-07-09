// messages/types.ts — DTOs y contrato del módulo (el schema de DB vive en ./model.ts)

export interface MessageDTO {
  id: string
  fromUserId: string
  toUserId: string
  message: string
  photoUrl: string | null
  isRead: boolean
  hotelId: string
  createdAt: string
  updatedAt: string
}

/** Usuario autenticado que envía o lee mensajes. */
export interface MessageUser {
  id: string
  hotelId: string
  role: string
}

export interface SendMessageDTO {
  toUserId: string
  message?: string
  photoUrl?: string | null
}

/** Última interacción con cada interlocutor, para la lista de chats. */
export interface Conversation {
  userId: string
  lastMessage: string
  lastPhoto: string | null
  lastTime: string
  isRead: boolean
  direction: 'sent' | 'received'
}
