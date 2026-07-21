// shared/usecases/link-hired-applicant.ts — Postulante contratado → expediente de empleado.
// La dispara el connector reclutamiento-empleados desde onApplicantHired. Vive acá (no en el
// connector) porque los connectors solo deben WIREAR: toda la lógica de negocio va en un usecase.
//
// Regla: NO fabrica credenciales. Un employee_profile requiere userId, así que solo crea el
// expediente cuando el postulante YA tiene cuenta (match por email dentro del hotel). Sin cuenta
// → no hace nada (provisionar login es una decisión de producto aparte). Best-effort.

interface ApplicantLike {
  id: string
  hotelId: string
  email?: string | null
  jobPositionId?: string | null
  hiredEmployeeId?: string | null
}

interface CreateProfilePort {
  createProfile: (dto: { userId: string; hotelId: string; jobPositionId?: string; hireDate?: string }) => Promise<{ id: string }>
}

export async function linkHiredApplicantToEmployee(orm: any, empleados: CreateProfilePort, applicant: ApplicantLike): Promise<void> {
  if (applicant.hiredEmployeeId) return             // ya vinculado a un expediente
  if (!applicant.email) return                      // sin email no se puede matchear un user
  // Match por email DENTRO del hotel (multi-tenancy): no ligar a un user de otro tenant.
  const users = await orm.findMany('Users', { email: applicant.email, hotelId: applicant.hotelId }) as any[]
  const user = users?.[0]
  if (!user) return                                 // no hay cuenta → no fabricamos credenciales

  // Si ese user ya tiene expediente, solo ligamos el back-ref (no duplicar perfil).
  const existing = await orm.findMany('EmployeeProfile', { userId: user.id }) as any[]
  let profileId = existing?.[0]?.id
  if (!profileId) {
    const profile = await empleados.createProfile({
      userId: user.id,
      hotelId: applicant.hotelId,
      jobPositionId: applicant.jobPositionId ?? undefined,
      hireDate: new Date().toISOString().split('T')[0],
    })
    profileId = profile.id
  }
  await orm.update('JobApplicant', applicant.id, { hiredEmployeeId: profileId })
}
