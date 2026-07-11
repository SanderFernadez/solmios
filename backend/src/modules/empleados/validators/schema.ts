// empleados/validators/schema.ts
import type { ValidationRule } from 'arckode-framework'

export const CreateDepartmentSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  name: { type: 'string' as const, required: true, min: 2, max: 100 },
  description: { type: 'string' as const },
  managerId: { type: 'string' as const },
  parentId: { type: 'string' as const },
}

export const CreateProfileSchema: Record<string, ValidationRule> = {
  userId: { type: 'string' as const, required: true },
  hotelId: { type: 'string' as const, required: true },
  position: { type: 'string' as const, max: 100 },
  salary: { type: 'number' as const, min: 0 },
  hireDate: { type: 'string' as const },
  departmentId: { type: 'string' as const },
}

export const CreateContractSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  employeeId: { type: 'string' as const, required: true },
  type: { type: 'string' as const, required: true },
  startDate: { type: 'string' as const, required: true },
  salary: { type: 'number' as const, required: true, min: 0 },
  // Sin declarar acá, validateSchema los descarta y el contrato pierde estos datos (mem 1805).
  endDate: { type: 'string' as const },
  currency: { type: 'string' as const },
  position: { type: 'string' as const },
  departmentId: { type: 'string' as const },
}

export const CreateDocumentSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  employeeId: { type: 'string' as const, required: true },
  type: { type: 'string' as const, required: true },
  name: { type: 'string' as const, required: true },
  fileUrl: { type: 'string' as const },
  expiryDate: { type: 'string' as const },
}

export const CreateLeaveRequestSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  employeeId: { type: 'string' as const, required: true },
  type: { type: 'string' as const, required: true, enum: ['vacation','permission','sick_leave','maternity','other'] },
  startDate: { type: 'string' as const, required: true },
  endDate: { type: 'string' as const, required: true },
  days: { type: 'number' as const, required: true, min: 1 },
  reason: { type: 'string' as const },
}

export const CreateReviewSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  employeeId: { type: 'string' as const, required: true },
  reviewerId: { type: 'string' as const, required: true },
  reviewDate: { type: 'string' as const, required: true },
  score: { type: 'number' as const, min: 1, max: 10 },
  period: { type: 'string' as const },
  strengths: { type: 'string' as const },
  improvements: { type: 'string' as const },
}

export const UpdateDepartmentSchema: Record<string, ValidationRule> = {
  name: { type: 'string' as const, min: 2, max: 100 },
  description: { type: 'string' as const },
  managerId: { type: 'string' as const },
  parentId: { type: 'string' as const },
}

export const UpdateProfileSchema: Record<string, ValidationRule> = {
  position: { type: 'string' as const, max: 100 },
  salary: { type: 'number' as const, min: 0 },
  hireDate: { type: 'string' as const },
  departmentId: { type: 'string' as const },
}

export const RejectLeaveRequestSchema: Record<string, ValidationRule> = {
  reason: { type: 'string' as const, max: 500 },
}
