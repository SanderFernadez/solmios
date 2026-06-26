// ai-gerente/types.ts — DTOs de M17 (interaction = pregunta/respuesta del gerente)

export interface AiGerenteDTO {
  id: string
  hotelId: string
  userId: string
  query: string
  response: string
  queryType?: string
  dataSourcesUsed?: string[]
  confidence?: number
  feedback?: string | null
  responseTimeMs?: number
  createdAt?: string
  updatedAt?: string
}

export interface CreateAiGerenteDTO {
  hotelId: string
  userId: string
  query: string
  response: string
  queryType?: string
  dataSourcesUsed?: string[]
  confidence?: number
  responseTimeMs?: number
}

export interface UpdateAiGerenteDTO {
  feedback?: string
}

export interface AiGerenteQuery {
  hotelId?: string
  userId?: string
  page?: number
  limit?: number
}

export interface AiGerentePaginated {
  data: AiGerenteDTO[]
  pagination: { page: number; limit: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean }
}

export interface AskRequest {
  query: string
  hotelId?: string
}
