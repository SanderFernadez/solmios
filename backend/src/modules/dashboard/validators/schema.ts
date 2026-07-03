import type { ValidationRule } from 'arckode-framework'

export const DashboardQuerySchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const },
}

export const DashboardValidator = {
  query: DashboardQuerySchema,
}
