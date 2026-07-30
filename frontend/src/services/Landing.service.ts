// services/Landing.service.ts — Cliente API de la LANDING PÚBLICA (F1 1.7, solmi-direct-booking / Pieza B).
//
// Un único endpoint público (sin auth, rate-limited por IP en el backend):
//   - GET /api/public/hotels/:slug/landing → { data: LandingBlock[], theme: LandingTheme | null }
//     (post-Task A, commit 5df115a). Antes devolvía `LandingBlock[]` suelto.
//
// El backend (Pieza A, commit d16a9e1) decide el catálogo FIJO de 9 types, hace seed default
// la primera vez, y descarta bloques con active=0. Acá solo consumimos el contract.
//
// El `http` client desenvolvuelve el envelope del framework y NO pega token si no hay sesión
// (ruta pública). La regex `isPublicAuthPath` en http.ts ya matchea `/public/` → un 401 acá
// no dispara logout falso (es "no pudiste entrar", no "sesión venció").
//
// Tipos en `@/types/landing` (re-exportados desde `@/types`).

import { http } from './http'
import type { PublicLandingResponse } from '@/types/landing'

export const LandingService = {
  /**
   * Lista los bloques activos (active=1) de la landing del hotel + el theme configurado.
   *
   * El backend hace seed default la primera vez (9 bloques + template classic) → esta
   * llamada SIEMPRE devuelve un array non-empty y un theme (aunque sea `null` → clasic).
   *
   * @param slug  slug estable del hotel (NO el id).
   */
  get(slug: string): Promise<PublicLandingResponse> {
    return http.get<PublicLandingResponse>(`/public/hotels/${encodeURIComponent(slug)}/landing`)
  },
}
