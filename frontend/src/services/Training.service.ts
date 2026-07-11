// services/Training.service.ts — Capacitación: cursos e inscripciones.
import { http } from './http'

export type CourseType = 'course' | 'certification' | 'onboarding'

export interface Course {
  id: string; hotelId: string; name: string
  type: CourseType | string; description: string | null
  durationHours: number | null; validityMonths: number | null; active: number
}

export interface Enrollment {
  id: string; hotelId: string; courseId: string; employeeId: string
  status: string; enrolledAt: string | null; completedAt: string | null
  expiresAt: string | null; score: number | null; notes: string | null
}

export const TrainingService = {
  async listCourses(): Promise<Course[]> {
    const res = await http.get<{ data: Course[] }>('/api/training/courses')
    return res.data ?? []
  },
  createCourse: (data: Partial<Course>): Promise<Course> => http.post('/api/training/courses', data),
  updateCourse: (id: string, data: Partial<Course>): Promise<Course> => http.put(`/api/training/courses/${id}`, data),
  deleteCourse: (id: string): Promise<void> => http.delete(`/api/training/courses/${id}`),

  async listEnrollments(): Promise<Enrollment[]> {
    const res = await http.get<{ data: Enrollment[] }>('/api/training/enrollments')
    return res.data ?? []
  },
  enroll: (data: { courseId: string; employeeId: string; notes?: string }): Promise<Enrollment> => http.post('/api/training/enrollments', data),
  complete: (id: string, score?: number): Promise<Enrollment> => http.post(`/api/training/enrollments/${id}/complete`, { score }),
  removeEnrollment: (id: string): Promise<void> => http.delete(`/api/training/enrollments/${id}`),
}

export const COURSE_TYPE_LABELS: Record<string, string> = {
  course: 'Curso', certification: 'Certificación', onboarding: 'Inducción',
}
