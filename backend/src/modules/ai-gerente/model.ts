// ai-gerente/model.ts — Schema de base de datos (M17 Gerente IA)
// Tabla: ai_manager_interactions (historial de preguntas/respuestas del gerente).
import type { ModelDefinition, ORM } from 'arckode-framework'

export const AiManagerInteractionModel: ModelDefinition = {
  table: 'ai_manager_interactions',
  timestamps: true,
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    userId: { type: 'string', required: true },
    query: { type: 'string', required: true },
    response: { type: 'string', required: true },
    queryType: { type: 'string' },
    dataSourcesUsed: { type: 'json', default: [] },
    confidence: { type: 'number' },
    feedback: { type: 'string' },
    responseTimeMs: { type: 'number' },
  },
}

export function registerAiGerenteModels(orm: ORM): void {
  orm.define('AiManagerInteraction', AiManagerInteractionModel)
}
