// shared/middlewares/scoped-rate-limit.ts — #658: el rate-limit global (200 req/min por IP,
// aplicado a TODO /api/*) mezclaba el presupuesto de intentos de login con el de navegación
// normal del panel. Una sola pasada de exploración (~21-40 rutas, cada pantalla dispara varios
// GETs) ya generaba 97-111 respuestas 429 — peor todavía si varios empleados comparten la IP de
// la oficina/hotel (NAT), que agotan el mismo cupo de 200 entre todos.
//
// `scopedRateLimit` envuelve el `rateLimit()` del framework para aplicarlo SOLO a los requests
// cuyo path matchea el predicado — permite tener un límite agresivo en /api/auth/* (fuerza
// bruta) y uno holgado para el resto (lectura normal del panel), sin que compitan por el mismo
// contador. El framework no expone scoping por path en su rateLimit(), así que se arma acá.
import type { HttpRequest, HttpResponse } from 'arckode-framework'
import { rateLimit } from 'arckode-framework/middlewares'

export function scopedRateLimit(
  matches: (path: string) => boolean,
  opts: Parameters<typeof rateLimit>[0],
) {
  const limiter = rateLimit(opts)
  return async (req: HttpRequest, next: () => Promise<HttpResponse>): Promise<HttpResponse> => {
    if (!matches(req.path)) return next()
    return limiter(req, next)
  }
}
