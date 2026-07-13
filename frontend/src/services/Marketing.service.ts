import { http } from './http'
import type {
  MarketingAutoMessage,
  CreateMarketingAutoMessage,
  MarketingWhatsappTemplate,
  CreateMarketingWhatsappTemplate,
  MarketingMessageLog,
} from '@/types'

/**
 * Espeja backend/src/modules/marketing/index.ts (9 endpoints registrados).
 * `createMessageLog` existe en el controller del backend pero NO tiene ruta
 * registrada — por eso no se expone acá.
 */
export const MarketingService = {
  // Auto-messages — settings:view/create/edit/delete
  listAutoMessages: () => http.get<{ data: MarketingAutoMessage[] }>('/auto-messages'),
  createAutoMessage: (data: CreateMarketingAutoMessage) => http.post<MarketingAutoMessage>('/auto-messages', data),
  updateAutoMessage: (id: string, data: Partial<CreateMarketingAutoMessage>) =>
    http.put<MarketingAutoMessage>(`/auto-messages/${id}`, data),
  deleteAutoMessage: (id: string) => http.delete<{ success: boolean }>(`/auto-messages/${id}`),

  // Plantillas WhatsApp — settings:view/create/edit/delete
  listTemplates: () => http.get<{ data: MarketingWhatsappTemplate[] }>('/whatsapp-templates'),
  createTemplate: (data: CreateMarketingWhatsappTemplate) =>
    http.post<MarketingWhatsappTemplate>('/whatsapp-templates', data),
  updateTemplate: (id: string, data: Partial<CreateMarketingWhatsappTemplate>) =>
    http.put<MarketingWhatsappTemplate>(`/whatsapp-templates/${id}`, data),
  deleteTemplate: (id: string) => http.delete<{ success: boolean }>(`/whatsapp-templates/${id}`),

  // Message logs — settings:view (solo lectura, filtro por reserva)
  listMessageLogs: (reservationId?: string) => {
    const query = reservationId ? `?reservationId=${encodeURIComponent(reservationId)}` : ''
    return http.get<{ data: MarketingMessageLog[] }>(`/message-logs${query}`)
  },
}
