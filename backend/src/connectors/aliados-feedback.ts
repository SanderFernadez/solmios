// connectors/aliados-feedback.ts — Wire: aliados → feedback (#559)
//
// "Escalar a SOLMI OS" (Aliado Certificado ayudando a uno de sus hoteles referidos) reusa el
// pipeline de feedback pins que ya existe (createPin → GitLab issue), en vez de construir un
// sistema de tickets nuevo. `aliados` no puede importar `feedback` (módulos aislados) — se le
// pasa la función y listo, mismo molde que canales-subscriptions.ts.
//
// Sin este connector, POST /api/aliados/my-hotels/:hotelId/escalate sigue validando ownership
// pero responde 400 ("connector sin wirear") en vez de crear el pin — falla visible, no silenciosa.
import type { ConnectorContext } from 'arckode-framework'

export function aliadosFeedbackConnector(ctx: ConnectorContext): void {
  const aliados = ctx.resolveModule<{ setEscalateHandler?: (fn: any) => void }>('aliados')
  const feedback = ctx.resolveModule<{ createPin: (dto: any) => Promise<unknown> }>('feedback')
  aliados.setEscalateHandler?.((payload: { hotelId: string; comment: string; userId?: string }) =>
    feedback.createPin({
      hotelId: payload.hotelId,
      route: '/panel/aliados',
      x: 0,
      y: 0,
      comment: payload.comment,
      category: 'Improvement',
      priority: 'medium',
      userId: payload.userId,
    }),
  )
}
