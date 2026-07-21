// connectors/reclutamiento-empleados.ts — El postulante contratado se convierte en empleado.
// reclutamiento emite onApplicantHired → linkHiredApplicantToEmployee (usecase). El connector
// solo wirea; la lógica (match por email, crear/ligar expediente) vive en el usecase compartido.
// Best-effort dentro del usecase: nunca rompe el flujo de contratación.

import type { ConnectorContext } from 'arckode-framework'
import { linkHiredApplicantToEmployee } from '../shared/usecases/link-hired-applicant'

export function reclutamientoEmpleadosConnector(orm: any): (ctx: ConnectorContext) => void {
  return (ctx: ConnectorContext) => {
    const reclutamiento = ctx.resolveModule<{ setSockets: (s: any) => void }>('reclutamiento')
    reclutamiento.setSockets({
      onApplicantHired: (applicant: any) =>
        linkHiredApplicantToEmployee(orm, ctx.resolveModule('empleados'), applicant).catch(() => {}),
    })
  }
}
