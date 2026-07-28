// services/AdminLanding.service.ts — Cliente API del BUILDER admin de la landing (F1 1.9,
// solmi-direct-booking / Pieza C). Distinto de `Landing.service.ts` (que es la lectura
// pública sin auth): este es el facade del admin sobre los 3 endpoints auth + permiso
// `landing:view|edit`:
//   - GET    /api/landing                  → {data: AdminLandingBlock[], total}
//   - PUT    /api/landing                  → bulk upsert atómico, body {blocks: [...]} → {data, total}
//   - PATCH  /api/landing/:id/toggle       → toggle rápido, body {active: bool} → AdminLandingBlock
//
// El backend (Pieza A, commit d16a9e1) decide el catálogo FIJO de 9 types y hace seed lazy
// la primera vez → `list()` SIEMPRE devuelve 9 bloques para un hotel con permiso. Acá solo
// consumimos el contract; la validación pormenorizada (type en enum, config shape por type)
// la hace el usecase `blocks-crud.ts` en el backend.
//
// Tipos en `@/types/landing` (re-exportados desde `@/types`).
//
// NOTA sobre atomicidad: el `upsert` del backend regenera los `id` (delete-all + create-many
// dentro de `orm.transaction`). Por eso, tras un PUT exitoso, el builder DEBE re-refrescar
// los bloques desde el backend antes de usar cualquier id posterior (ej: un toggle inline).

import { http } from './http'
import type {
  AdminLandingBlock,
  AdminLandingListResult,
  UpsertLandingBlockInput,
} from '@/types/landing'

export const AdminLandingService = {
  /**
   * Lista los 9 bloques del hotel del admin (seed lazy la primera vez).
   * Requiere permiso `landing:view`. Ordenados por `sortOrder` ASC.
   */
  list(): Promise<AdminLandingListResult> {
    return http.get<AdminLandingListResult>('/landing')
  },

  /**
   * Reemplazo atómico del array completo de bloques. Body: `{blocks: [...]}`.
   * El backend valida cada item (type en enum, sin duplicados) ANTES de tocar la tabla;
   * si algo falla a mitad de la transacción, los bloques viejos se preservan.
   *
   * Devuelve el array nuevo con sus IDs frescos (regenerados en cada upsert).
   */
  upsert(blocks: UpsertLandingBlockInput[]): Promise<AdminLandingListResult> {
    return http.put<AdminLandingListResult>('/landing', { blocks })
  },

  /**
   * Toggle rápido de `active` para un bloque (sin re-PUT todo el array).
   * Requiere permiso `landing:edit`. Útil para switches inline que persisten al instante.
   * El builder por default NO lo usa (incluye el toggle en el bulk save) — queda expuesto
   * para futuros flujos donde el admin quiera cambiar visibilidad sin guardar todo.
   */
  toggle(id: string, active: boolean): Promise<AdminLandingBlock> {
    return http.patch<AdminLandingBlock>(
      `/landing/${encodeURIComponent(id)}/toggle`,
      { active },
    )
  },
}
