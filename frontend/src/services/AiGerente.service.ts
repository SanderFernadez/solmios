// services/AiGerente.service.ts — API client para el módulo AI Gerente

import { http } from './http'

export type AiFeedback = 'helpful' | 'not_helpful' | 'inaccurate'

export interface AiInteraction {
  id: string
  hotelId: string
  userId: string
  query: string
  response: string
  queryType?: string
  dataSourcesUsed?: string[]
  confidence?: number
  feedback?: AiFeedback | null
  responseTimeMs?: number
  createdAt?: string
  updatedAt?: string
}

export interface AiInteractionsPage {
  data: AiInteraction[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export const AiGerenteService = {
  /** Envía una pregunta al gerente IA y devuelve la interacción con la respuesta. */
  async ask(query: string, hotelId?: string): Promise<AiInteraction> {
    return http.post('/api/ai/manager/ask', { query, ...(hotelId ? { hotelId } : {}) })
  },

  /** Lista el historial de interacciones (paginado). */
  async listInteractions(params: { page?: number; limit?: number } = {}): Promise<AiInteractionsPage> {
    const qs = new URLSearchParams()
    if (params.page) qs.set('page', String(params.page))
    if (params.limit) qs.set('limit', String(params.limit))
    const suffix = qs.toString() ? `?${qs.toString()}` : ''
    return http.get(`/api/ai/manager/interactions${suffix}`)
  },

  /** Registra feedback sobre una interacción. */
  async sendFeedback(id: string, feedback: AiFeedback): Promise<AiInteraction> {
    return http.patch(`/api/ai/manager/interactions/${id}/feedback`, { feedback })
  },
}
