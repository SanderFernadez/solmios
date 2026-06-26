// marketing/types.ts

export interface AutoMessageDTO {
  id: string; hotelId: string; title: string; color: string
  emailSubject: string; emailBody: string; whatsappBody: string
  channel: string; triggerEvent: string; triggerOffset: number
  variables: string | null; isActive: number
  createdAt: string; updatedAt: string
}

export interface CreateAutoMessageDTO {
  hotelId: string; title: string; color?: string
  emailSubject?: string; emailBody?: string; whatsappBody?: string
  channel?: string; triggerEvent?: string; triggerOffset?: number
  variables?: string; isActive?: boolean
}

export interface MessageLogDTO {
  id: string; hotelId: string; reservationId: string | null
  messageId: string | null; messageType: string; status: string
  recipient: string | null; response: string | null; sentAt: string | null
  createdAt: string
}

export interface CreateMessageLogDTO {
  hotelId: string; reservationId?: string; messageId?: string
  messageType?: string; status?: string; recipient?: string; response?: string
}

export interface WhatsappTemplateDTO {
  id: string; hotelId: string; name: string; body: string
  category: string; isActive: number
  createdAt: string; updatedAt: string
}

export interface CreateWhatsappTemplateDTO {
  hotelId: string; name: string; body?: string; category?: string; isActive?: boolean
}
