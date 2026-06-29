// composables/useCountryFlag.ts — Helper de bandera país/idioma (F3 match-misterplan).
// Mapea texto de nacionalidad (catálogo de reservations/guests) e idioma → emoji bandera.
// Normaliza (minúsculas + sin acentos) para tolerar variantes de input.

const NATIONALITY_FLAGS: Record<string, string> = {
  // Español (catálogo del form)
  dominicana: '🇩🇴', estadounidense: '🇺🇸', española: '🇪🇸', colombiana: '🇨🇴',
  mexicana: '🇲🇽', argentina: '🇦🇷', venezolana: '🇻🇪', puertorriqueña: '🇵🇷',
  cubana: '🇨🇺', brasileña: '🇧🇷', chilena: '🇨🇱', peruana: '🇵🇪',
  ecuatoriana: '🇪🇨', hondureña: '🇭🇳', guatemalteca: '🇬🇹', salvadoreña: '🇸🇻',
  nicaraguense: '🇳🇮', costarricense: '🇨🇷', panameña: '🇵🇦', uruguaya: '🇺🇾',
  paraguaya: '🇵🇾', boliviana: '🇧🇴', canadiense: '🇨🇦', francesa: '🇫🇷',
  alemana: '🇩🇪', italiana: '🇮🇹', britanica: '🇬🇧', inglesa: '🇬🇧',
  china: '🇨🇳', japonesa: '🇯🇵', coreana: '🇰🇷', australiana: '🇦🇺',
  rusa: '🇷🇺', portuguesa: '🇵🇹', holandesa: '🇳🇱', belga: '🇧🇪',
  suiza: '🇨🇭', sueca: '🇸🇪', noruega: '🇳🇴', danesa: '🇩🇰',
  finlandesa: '🇫🇮', griega: '🇬🇷', turca: '🇹🇷', israeli: '🇮🇱',
  egipcia: '🇪🇬', sudafricana: '🇿🇦', marroqui: '🇲🇦', india: '🇮🇳',
  // Inglés (OTA / pre-checkin)
  'united states': '🇺🇸', 'american': '🇺🇸', usa: '🇺🇸', us: '🇺🇸',
  'dominican republic': '🇩🇴', dr: '🇩🇴', do: '🇩🇴',
  spain: '🇪🇸', es: '🇪🇸', colombia: '🇨🇴', co: '🇨🇴',
  mexico: '🇲🇽', mx: '🇲🇽', venezuela: '🇻🇪', ve: '🇻🇪',
  'puerto rico': '🇵🇷', pr: '🇵🇷', cuba: '🇨🇺', cu: '🇨🇺',
  brazil: '🇧🇷', 'brasil': '🇧🇷', br: '🇧🇷', chile: '🇨🇱', cl: '🇨🇱',
  peru: '🇵🇪', pe: '🇵🇪', ecuador: '🇪🇨', ec: '🇪🇨',
  honduras: '🇭🇳', hn: '🇭🇳', guatemala: '🇬🇹', gt: '🇬🇹',
  'el salvador': '🇸🇻', sv: '🇸🇻', nicaragua: '🇳🇮', ni: '🇳🇮',
  'costa rica': '🇨🇷', cr: '🇨🇷', panama: '🇵🇦', pa: '🇵🇦',
  uruguay: '🇺🇾', uy: '🇺🇾', paraguay: '🇵🇾', py: '🇵🇾',
  bolivia: '🇧🇴', bo: '🇧🇴', canada: '🇨🇦', ca: '🇨🇦',
  france: '🇫🇷', fr: '🇫🇷', germany: '🇩🇪', de: '🇩🇪',
  italy: '🇮🇹', it: '🇮🇹', 'united kingdom': '🇬🇧', uk: '🇬🇧', gb: '🇬🇧',
  cn: '🇨🇳', japan: '🇯🇵', jp: '🇯🇵',
  'south korea': '🇰🇷', korea: '🇰🇷', kr: '🇰🇷', australia: '🇦🇺', au: '🇦🇺',
  russia: '🇷🇺', ru: '🇷🇺', portugal: '🇵🇹', pt: '🇵🇹',
}

const LANGUAGE_FLAGS: Record<string, string> = {
  es: '🇪🇸', espanol: '🇪🇸', english: '🇬🇧', en: '🇬🇧',
  frances: '🇫🇷', francais: '🇫🇷', fr: '🇫🇷',
  portugues: '🇵🇹', português: '🇵🇹', pt: '🇵🇹',
  deutsch: '🇩🇪', de: '🇩🇪', aleman: '🇩🇪',
  italiano: '🇮🇹', it: '🇮🇹', chino: '🇨🇳', '中文': '🇨🇳', zh: '🇨🇳',
  japones: '🇯🇵', '日本語': '🇯🇵', ja: '🇯🇵', ruso: '🇷🇺', 'русский': '🇷🇺', ru: '🇷🇺',
}

/** Quita acentos y pasa a minúsculas para tolerar variantes. */
function normalize(s: string | null | undefined): string {
  return (s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function nationalityToFlag(nationality?: string | null): string {
  if (!nationality) return '🏳️'
  return NATIONALITY_FLAGS[normalize(nationality)] || '🏳️'
}

export function languageToFlag(language?: string | null): string {
  if (!language) return '🏳️'
  const n = normalize(language)
  return LANGUAGE_FLAGS[n] || LANGUAGE_FLAGS[language.toLowerCase()] || '🏳️'
}

export function useCountryFlag() {
  return { nationalityToFlag, languageToFlag }
}
