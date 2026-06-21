// mantenimiento/validators/schema.ts — Validación de entrada

import type { ValidationRule } from 'arckode-framework'

export const CreateMantenimientoSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
    title: { type: 'string' as const, required: true, min: 2, max: 200 },
    roomId: { type: 'string' as const },
    roomNumber: { type: 'string' as const },
    description: { type: 'text' as any },
    category: { type: 'string' as const },
    priority: { type: 'string' as const },
    status: { type: 'string' as const },
    assignedTo: { type: 'string' as const },
    estimatedCost: { type: 'number' as const },
    reportedDate: { type: 'string' as const },
    resolvedDate: { type: 'string' as const },
}

export const UpdateMantenimientoSchema: Record<string, ValidationRule> = {
    title: { type: 'string' as const, min: 2, max: 200 },
    roomId: { type: 'string' as const },
    roomNumber: { type: 'string' as const },
    description: { type: 'text' as any },
    category: { type: 'string' as const },
    priority: { type: 'string' as const },
    status: { type: 'string' as const },
    assignedTo: { type: 'string' as const },
    estimatedCost: { type: 'number' as const },
    reportedDate: { type: 'string' as const },
    resolvedDate: { type: 'string' as const },
}

export const MantenimientoValidator = {
  create: CreateMantenimientoSchema,
  update: UpdateMantenimientoSchema,
}
