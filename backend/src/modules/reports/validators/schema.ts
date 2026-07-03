import type { ValidationRule } from 'arckode-framework'

const REPORT_TYPE_ENUM = ['facturacion', 'ocupacion', 'pernoctaciones', 'rendimiento', 'procedencia', 'reservas']

export const ReportsQuerySchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const },
  type: { type: 'string' as const, enum: REPORT_TYPE_ENUM },
  from: { type: 'string' as const, pattern: /^\d{4}-\d{2}-\d{2}$/ },
  to: { type: 'string' as const, pattern: /^\d{4}-\d{2}-\d{2}$/ },
}

export const ReportsValidator = {
  query: ReportsQuerySchema,
}
