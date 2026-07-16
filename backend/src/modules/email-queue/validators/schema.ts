import type { ValidationRule } from 'arckode-framework'

// La lista se filtra por query params (status). El reencolado (POST /:id/requeue) no lleva body:
// resetea la fila por id. Igual exponemos un schema de query para validar el filtro de estado.
export const ListEmailQueueSchema: Record<string, ValidationRule> = {
  status: { type: 'string' as const, enum: ['pending', 'processing', 'sent', 'failed'] },
  page: { type: 'number' as const },
  limit: { type: 'number' as const },
}

export const EmailQueueValidator = { list: ListEmailQueueSchema }
