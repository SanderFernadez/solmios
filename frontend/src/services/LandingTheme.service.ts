// services/LandingTheme.service.ts — Cliente API del THEME de la landing pública
// (solmi-direct-booking / Pieza C — editor Apariencia).
//
// Endpoints admin (auth + permiso `landing:view|edit`, commit 5df115a Task A):
//   - GET /api/landing/theme  → LandingTheme {templateId, colors?, fonts?}
//   - PUT /api/landing/theme  → body LandingTheme → LandingTheme persistido
//
// El backend devuelve el theme directo (default lazy `{templateId:'classic'}` si no hay
// fila en `configuration` — ver `theme-crud.ts`). El `http` client desenvolvuelve el
// envelope del framework, así que `getTheme()` retorna el objeto `LandingTheme` pelado.
//
// El allow-list de colors/fonts y el enum `templateId` se validan en el backend
// (`ThemeSchema` + `sanitizeColors`/`sanitizeFonts`); acá solo consumimos el contract.
//
// Tipos en `@/types/landing` (re-exportados desde `@/types`).

import { http } from './http'
import type { LandingTheme } from '@/types/landing'

export const LandingThemeService = {
  /**
   * Devuelve el theme configurado para el hotel del JWT.
   * Si nunca se guardó ninguno, el backend responde `{templateId:'classic'}` (default lazy).
   */
  getTheme(): Promise<LandingTheme> {
    return http.get<LandingTheme>('/landing/theme')
  },

  /**
   * Persiste el theme completo. Reemplaza el anterior (PUT semántica de item único).
   *
   * El backend valida `templateId` (enum) + allow-list de colors/fonts y, tras escribir,
   * invalida la caché pública `landing:public:${hotelId}` → el cambio se refleja en la
   * landing pública al próximo request.
   */
  saveTheme(theme: LandingTheme): Promise<LandingTheme> {
    return http.put<LandingTheme>('/landing/theme', theme)
  },
}
