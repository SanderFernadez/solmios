// empleados/validators/schema.ts
import type { ValidationRule } from 'arckode-framework'

export const CreateDepartmentSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  name: { type: 'string' as const, required: true, min: 2, max: 100 },
  description: { type: 'string' as const, max: 500 },
  managerId: { type: 'string' as const },
  parentId: { type: 'string' as const },
}

export const CreateProfileSchema: Record<string, ValidationRule> = {
  userId: { type: 'string' as const, required: true },
  hotelId: { type: 'string' as const, required: true },
  position: { type: 'string' as const, max: 100 },
  // Mismo tope que CreateContractSchema (#173/#176/#588): el front ya lo limita, el backend
  // lo respalda para no confiar solo en la validación del cliente.
  salary: { type: 'number' as const, min: 0, max: 99_999_999 },
  hireDate: { type: 'string' as const },
  birthDate: { type: 'string' as const },
  departmentId: { type: 'string' as const },
  jobPositionId: { type: 'string' as const },
  nationality: { type: 'string' as const, max: 60 },
  maritalStatus: { type: 'string' as const, max: 20 },
  gender: { type: 'string' as const, max: 20 },
  education: { type: 'string' as const, max: 100 },
}

export const CreateContractSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  employeeId: { type: 'string' as const, required: true },
  type: { type: 'string' as const, required: true, max: 40 },
  startDate: { type: 'string' as const, required: true },
  salary: { type: 'number' as const, required: true, min: 0, max: 99_999_999 },
  // Sin declarar acá, validateSchema los descarta y el contrato pierde estos datos (mem 1805).
  endDate: { type: 'string' as const },
  currency: { type: 'string' as const, max: 8 },
  position: { type: 'string' as const, max: 100 },
  departmentId: { type: 'string' as const },
}

export const CreateDocumentSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  employeeId: { type: 'string' as const, required: true },
  type: { type: 'string' as const, required: true, max: 40 },
  name: { type: 'string' as const, required: true, min: 2, max: 120 },
  fileUrl: { type: 'string' as const },
  expiryDate: { type: 'string' as const },
}

export const CreateLeaveRequestSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  employeeId: { type: 'string' as const, required: true },
  type: { type: 'string' as const, required: true },
  // Referencia opcional al tipo configurable (leave_types).
  leaveTypeId: { type: 'string' as const },
  startDate: { type: 'string' as const, required: true },
  endDate: { type: 'string' as const, required: true },
  // `days` lo calcula el servidor desde el rango (#188). Opcional acá; si viene, se ignora.
  days: { type: 'number' as const, min: 0 },
  reason: { type: 'string' as const, max: 500 },
}

export const CreateReviewSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  employeeId: { type: 'string' as const, required: true },
  reviewerId: { type: 'string' as const, required: true },
  reviewDate: { type: 'string' as const, required: true },
  // Puntaje 1-10 (#192). Sin declarar los demás, validateSchema los descarta (mem 1805).
  score: { type: 'number' as const, min: 1, max: 10 },
  period: { type: 'string' as const, max: 20 },
  strengths: { type: 'string' as const, max: 2000 },
  improvements: { type: 'string' as const, max: 2000 },
  goals: { type: 'string' as const, max: 2000 },
  notes: { type: 'string' as const, max: 2000 },
  selfScore: { type: 'number' as const, min: 1, max: 10 },
  selfComments: { type: 'string' as const, max: 2000 },
  templateId: { type: 'string' as const },
  answers: { type: 'string' as const },
}

// Editar borrador (#193). Mismo rango de puntaje; sin hotelId/employeeId (no se reasigna dueño).
export const UpdateReviewSchema: Record<string, ValidationRule> = {
  reviewDate: { type: 'string' as const },
  score: { type: 'number' as const, min: 1, max: 10 },
  period: { type: 'string' as const, max: 20 },
  strengths: { type: 'string' as const, max: 2000 },
  improvements: { type: 'string' as const, max: 2000 },
  goals: { type: 'string' as const, max: 2000 },
  notes: { type: 'string' as const, max: 2000 },
  selfScore: { type: 'number' as const, min: 1, max: 10 },
  selfComments: { type: 'string' as const, max: 2000 },
  templateId: { type: 'string' as const },
  answers: { type: 'string' as const },
  acknowledged: { type: 'boolean' as const },
}

export const CreateAppraisalTemplateSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  name: { type: 'string' as const, required: true, min: 2, max: 80 },
  // questions llega como array; el usecase lo serializa a JSON. Se valida presencia en el usecase.
}

export const CreateJobPositionSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  name: { type: 'string' as const, required: true, min: 2, max: 80 },
  departmentId: { type: 'string' as const },
  description: { type: 'string' as const, max: 500 },
  expectedEmployees: { type: 'number' as const, min: 0 },
}

export const CreateContractTypeSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  code: { type: 'string' as const, required: true, min: 2, max: 40 },
  name: { type: 'string' as const, required: true, min: 2, max: 60 },
}

export const CreateWorkLocationSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  name: { type: 'string' as const, required: true, min: 2, max: 80 },
  address: { type: 'string' as const, max: 200 },
}

export const UpdateDepartmentSchema: Record<string, ValidationRule> = {
  name: { type: 'string' as const, min: 2, max: 100 },
  description: { type: 'string' as const },
  managerId: { type: 'string' as const },
  parentId: { type: 'string' as const },
}

export const UpdateProfileSchema: Record<string, ValidationRule> = {
  position: { type: 'string' as const, max: 100 },
  salary: { type: 'number' as const, min: 0, max: 99_999_999 },
  hireDate: { type: 'string' as const },
  birthDate: { type: 'string' as const },
  departmentId: { type: 'string' as const },
  jobPositionId: { type: 'string' as const },
  nationality: { type: 'string' as const, max: 60 },
  maritalStatus: { type: 'string' as const, max: 20 },
  gender: { type: 'string' as const, max: 20 },
  education: { type: 'string' as const, max: 100 },
}

export const RejectLeaveRequestSchema: Record<string, ValidationRule> = {
  // Motivo OBLIGATORIO al rechazar (#190/#191): no se rechaza sin justificar.
  reason: { type: 'string' as const, required: true, min: 3, max: 500 },
}

// ─── Time Off config ────────────────────────────────────
export const CreateLeaveTypeSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  code: { type: 'string' as const, required: true, min: 2, max: 40 },
  name: { type: 'string' as const, required: true, min: 2, max: 60 },
  color: { type: 'string' as const, max: 20 },
  paid: { type: 'boolean' as const },
  requiresApproval: { type: 'boolean' as const },
  maxDaysPerYear: { type: 'number' as const, min: 0 },
}

export const UpdateLeaveTypeSchema: Record<string, ValidationRule> = {
  name: { type: 'string' as const, min: 2, max: 60 },
  color: { type: 'string' as const, max: 20 },
  paid: { type: 'boolean' as const },
  requiresApproval: { type: 'boolean' as const },
  maxDaysPerYear: { type: 'number' as const, min: 0 },
}

export const CreateLeaveAllocationSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  employeeId: { type: 'string' as const, required: true },
  leaveTypeId: { type: 'string' as const, required: true },
  year: { type: 'number' as const, required: true, min: 2000 },
  days: { type: 'number' as const, required: true, min: 0 },
  notes: { type: 'string' as const, max: 200 },
}

export const CreatePublicHolidaySchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  date: { type: 'string' as const, required: true },
  name: { type: 'string' as const, required: true, min: 2, max: 80 },
  recurring: { type: 'boolean' as const },
}

// ─── Performance Eval config (#322) ─────────────────────
// Solo los escalares se validan acá. weights/thresholds son objetos y viajan aparte (el controller
// los pasa desde el body crudo — validateSchema descartaría un campo objeto). Sus reglas de
// negocio (suma 100, umbrales descendentes) las impone EvalConfigUseCase.update.
export const UpdateEvalConfigSchema: Record<string, ValidationRule> = {
  period: { type: 'string' as const, max: 20 },
  standardTaskMinutes: { type: 'number' as const, min: 1 },
  enabled: { type: 'boolean' as const },
}
