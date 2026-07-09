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

/** Un compañero de trabajo al que se le puede escribir. Proyección mínima: nunca email ni teléfono. */
export interface ContactDTO {
  id: string
  name: string
  role: string
}

/**
 * Puerto hacia el módulo `usuarios`. Lo cablea `connectors/messages-usuarios.ts`.
 * El chat necesita los nombres de sus interlocutores sin depender del permiso `users:view`,
 * que housekeeper/supervisor/maintenance no tienen.
 */
export interface UserDirectory {
  listStaff(hotelId: string): Promise<ContactDTO[]>
}
