// seeds/hotelmedia.ts — DESHABILITADO.
//
// Este proyecto NO usa seeds del CLI (la convención es `migrate-db.ts` para seeds
// demo + tablas extra). El archivo se deja como no-op para no romper un futuro
// `arckode db-seed` que lo descubra por convención.
import type { SeedOrm } from 'arckode-framework/cli/commands/db-seed'

export async function seedHotelmedia(_orm: SeedOrm): Promise<void> {
  // Intencionalmente vacío. No hay seed demo para hotel_media (la media la sube el
  // admin del hotel desde la UI de Settings, spec hotel-media/UI).
}
