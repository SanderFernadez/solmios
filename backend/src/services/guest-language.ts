// services/guest-language.ts — Resuelve el idioma de notificación de un huésped.
//
// Prioridad: language explícita del guest > inferencia por nationality > default 'es'.
// Soporta nationality como nombre de país ("Argentina", "United States") o código ISO ("AR", "US").

import type { NotificationLanguage } from './notification-defaults'

export interface GuestLanguageInput {
  language?: string | null
  nationality?: string | null
}

// Nombres de país (o fragmentos iniciales) → idioma. Minúsculas, sin acentos para matching robusto.
const ES_COUNTRIES = /^(espana|spain|mexico|argentina|colombia|chile|peru|uruguay|paraguay|ecuador|bolivia|venezuela|cuba|dominican|guatemala|honduras|nicaragua|panama|costa rica|el salvador|puerto rico|espanol|español)/
const PT_COUNTRIES = /^(brasil|brazil|portugal|portugues|português)/
const EN_COUNTRIES = /^(united states|usa|us|uk|united kingdom|england|canada|australia|ireland|new zealand|south africa|india)/

// Códigos ISO de país → idioma.
const ES_ISO = /^(es|mx|ar|co|cl|pe|uy|py|ec|bo|ve|cu|do|gt|hn|ni|pa|cr|sv|pr)$/
const PT_ISO = /^(br|pt)$/
const EN_ISO = /^(us|gb|uk|ca|au|ie|nz|za|in)$/

// Nombres de idioma (forma nativa o traducida) → código. El frontend guarda language a veces como
// nombre completo (reservations usa 'Español'/'English'; booking-engine usa ISO 'es'/'en').
const LANG_NAMES: Record<string, NotificationLanguage> = {
  español: 'es', espanol: 'es', spanish: 'es', castellano: 'es',
  english: 'en', ingles: 'en', inglés: 'en',
  português: 'pt', portugues: 'pt', portuguese: 'pt',
}

/**
 * Devuelve el idioma ('es' | 'en' | 'pt') para notificar al huésped.
 * - `language` explícita válida tiene prioridad (nombre completo o código ISO).
 * - Si no, infiere de `nationality` (nombre o ISO).
 * - Default 'es' (nunca debe bloquear un envío por idioma desconocido).
 */
export function resolveGuestLanguage(guest: GuestLanguageInput): NotificationLanguage {
  if (guest.language) {
    const l = guest.language.trim().toLowerCase()
    if (LANG_NAMES[l]) return LANG_NAMES[l]
    const code = l.slice(0, 2)
    if (code === 'es' || code === 'en' || code === 'pt') return code
  }
  const nat = (guest.nationality || '').trim().toLowerCase()
  if (nat) {
    if (ES_ISO.test(nat) || ES_COUNTRIES.test(nat)) return 'es'
    if (PT_ISO.test(nat) || PT_COUNTRIES.test(nat)) return 'pt'
    if (EN_ISO.test(nat) || EN_COUNTRIES.test(nat)) return 'en'
  }
  return 'es'
}
