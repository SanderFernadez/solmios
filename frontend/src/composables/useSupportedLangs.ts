// composables/useSupportedLangs.ts — Los 12 idiomas soportados por la plataforma (F4 — carta
// multi-idioma). Lista EXACTA reusada de settings/index.vue (descripción multilingüe del hotel,
// pages/settings/index.vue:1464-1477) — no inventar una lista nueva en cada pantalla que traduzca algo.
export interface SupportedLang {
  code: string
  name: string
  flag: string
}

export const supportedLangs: SupportedLang[] = [
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'ca', name: 'Català', flag: '🇪🇸' },
]

export function useSupportedLangs() {
  return { supportedLangs }
}
