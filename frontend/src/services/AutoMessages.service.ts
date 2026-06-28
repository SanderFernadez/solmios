import { http } from './http'

export interface AutoMessage {
  id?: string
  hotelId?: string
  title: string
  color: string
  emailSubject?: string
  emailBody?: string
  whatsappBody?: string
  channel: 'email' | 'whatsapp' | 'both'
  triggerEvent: 'reservation_created' | 'pre_checkin' | 'checkin_day' | 'checkout_day' | 'post_stay' | string
  triggerOffset: number
  variables?: string[]
  isActive: boolean
  event?: string
  language?: string
  triggerType?: string
}

export interface AutoMessageInput {
  title: string
  color: string
  emailSubject?: string
  emailBody?: string
  whatsappBody?: string
  channel?: string
  triggerEvent?: string
  triggerOffset?: number
  variables?: string[]
  isActive?: boolean
  event?: string
  language?: string
  triggerType?: string
}

export const AutoMessagesService = {
  list: () => http.get<{ data: AutoMessage[] }>('/auto-messages'),
  create: (data: AutoMessageInput) => http.post<AutoMessage>('/auto-messages', data),
  update: (id: string, data: Partial<AutoMessageInput>) => http.put<AutoMessage>(`/auto-messages/${id}`, data),
  remove: (id: string) => http.delete<{ success: boolean }>(`/auto-messages/${id}`),
}
