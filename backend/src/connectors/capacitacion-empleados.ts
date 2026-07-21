// connectors/capacitacion-empleados.ts — El curso completado alimenta el expediente del empleado.
// capacitacion emite onEnrollmentCompleted; empleados registra un documento 'training' en el
// expediente (employee_documents). Cierra el gap "los cursos no alimentan el expediente".
// NO calcula scoring de desempeño (eso es #321, sin fórmula definida): solo deja rastro real.
// Best-effort: si empleados no carga o falla, NO rompe el cierre del curso.

import type { ConnectorContext } from 'arckode-framework'

interface EnrollmentLike {
  hotelId: string
  employeeId: string   // = EmployeeProfile.id
  score?: number | null
  completedAt?: string
}

export function capacitacionEmpleadosConnector(ctx: ConnectorContext): void {
  const capacitacion = ctx.resolveModule<{ setSockets: (s: any) => void }>('capacitacion')
  capacitacion.setSockets({
    onEnrollmentCompleted: async (enrollment: EnrollmentLike, courseName?: string) => {
      try {
        if (!enrollment?.employeeId || !enrollment?.hotelId) return
        const empleados = ctx.resolveModule<{
          createDocument: (dto: { hotelId: string; employeeId: string; type: string; name: string; issuedBy?: string; notes?: string }) => Promise<unknown>
        }>('empleados')
        const scoreNote = enrollment.score != null ? ` · Calificación: ${enrollment.score}` : ''
        await empleados.createDocument({
          hotelId: enrollment.hotelId,
          employeeId: enrollment.employeeId,
          type: 'training',
          name: `Capacitación completada: ${courseName ?? 'curso'}`,
          issuedBy: 'Capacitación',
          notes: `Registrado automáticamente al completar el curso${scoreNote}`,
        })
      } catch {
        // Best-effort: empleados puede no estar disponible. No rompe el cierre del curso.
      }
    },
  })
}
