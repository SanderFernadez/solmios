// capacitacion/types.ts — DTOs de cursos e inscripciones.

export type CourseType = 'course' | 'certification' | 'onboarding'
export type EnrollmentStatus = 'enrolled' | 'completed'

export interface CourseDTO {
  id: string; hotelId: string; name: string
  type: CourseType | string; description: string | null
  durationHours: number | null; validityMonths: number | null; active: number
  createdAt: string; updatedAt: string
}

export interface CreateCourseDTO {
  hotelId: string; name: string; type?: string
  description?: string; durationHours?: number; validityMonths?: number
}

export interface EnrollmentDTO {
  id: string; hotelId: string; courseId: string; employeeId: string
  status: EnrollmentStatus | string
  enrolledAt: string | null; completedAt: string | null; expiresAt: string | null
  score: number | null; notes: string | null
  createdAt: string; updatedAt: string
}

export interface CreateEnrollmentDTO {
  hotelId: string; courseId: string; employeeId: string; notes?: string
}

// Aliases que espera el scaffold (index/sockets los referencian).
export type CapacitacionDTO = CourseDTO
export interface CapacitacionQuery { hotelId?: string; employeeId?: string; courseId?: string }
