// services/TeamChat.service.ts — Monitor de solo lectura de los chats internos del equipo.
// El admin ve TODAS las conversaciones del hotel (grupal + 1-a-1) vía GET /messages/all.

import { http } from './http'

/** Mensaje crudo tal como lo devuelve el backend. */
export interface MessageDTO {
  id: string
  fromUserId: string
  toUserId: string
  message: string
  photoUrl?: string | null
  isRead: boolean | number
  hotelId: string
  createdAt: string
  updatedAt: string
}

export const TeamChatService = {
  /**
   * Trae TODOS los mensajes del hotel (solo managers/admin).
   * El backend devuelve un array plano; el cliente agrupa en conversaciones.
   */
  async listAll(): Promise<MessageDTO[]> {
    const res = await http.get<MessageDTO[]>('/messages/all')
    return Array.isArray(res) ? res : ((res as { data?: MessageDTO[] })?.data ?? [])
  },
}
