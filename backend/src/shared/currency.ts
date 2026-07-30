// shared/currency.ts — Source of truth global de monedas (ISO 4217).
//
// Antes (estado previo al refactor): 6 enums/const parciales con listas incompletas y
// divergentes entre sí (intl-catalogs.ts, azul-gateway.ts, useBooking.ts, empleados/index.vue,
// settings/index.vue, azul-gateway.test.ts) + ~230 strings sueltos ('USD' / 'EUR' / 'DOP' / ...)
// esparcidos en backend y frontend. Cualquier cambio de catálogo requería tocar muchos puntos y
// era fácil olvidar uno.
//
// Este archivo es la única fuente de verdad BACKEND. El frontend tiene un espejo en
// `frontend/src/types/currency.ts` (mismos codes + misma metadata) — mantener sincronizado.
// Los 6 enums parciales ahora importan de acá vía el espejo frontend.
//
// Por qué NO un `const enum`: Bun/tsc no aísla bien `const enum` entre proyectos ( Issues con
// `isolatedModules`), y los payloads desde la API / DB vienen como `string` — necesitamos type
// guard + helper para validar en runtime. Un array `as const` + type union es más portable.
//
// Acerca de los defaults: la columna ORM `currency: { type: 'string', default: 'USD' }` sigue
// siendo `string` (el ORM no tipa contra CurrencyCode), pero los usecases que construyen DTOs
// sí pueden tipar `currency: CurrencyCode = CurrencyCode.USD` para que TS valide el set.

/**
 * Enum-like de monedas (ISO 4217) — mismo nombre para valor y tipo, patrón TypeScript
 * recomendado para evitar `const enum` (que tiene issues con isolatedModules/Bun).
 *
 * Uso como valor: `CurrencyCode.USD` → `'USD'` (reemplaza el string suelto).
 * Uso como tipo:  `currency: CurrencyCode` (TS valida que sea uno del conjunto).
 */
export const CurrencyCode = {
  USD: 'USD', // Dólar estadounidense — default del proyecto
  EUR: 'EUR', // Euro
  DOP: 'DOP', // Peso dominicano — mercado principal (DR)
  MXN: 'MXN', // Peso mexicano
  COP: 'COP', // Peso colombiano
  ARS: 'ARS', // Peso argentino
  BRL: 'BRL', // Real brasileño
  PEN: 'PEN', // Sol peruano
  CLP: 'CLP', // Peso chileno (0 decimales)
  GBP: 'GBP', // Libra esterlina
  CAD: 'CAD', // Dólar canadiense
  CHF: 'CHF', // Franco suizo
  // Hardening go-live (solmi-direct-booking) — 10 monedas extra para el widget de geo-IP
  // (COUNTRY_TO_CURRENCY ya mapeaba estos países pero caían a fallback USD por no estar acá).
  UYU: 'UYU', // Peso uruguayo
  PYG: 'PYG', // Guaraní paraguayo
  BOB: 'BOB', // Boliviano (Bolivia)
  VES: 'VES', // Bolívar venezolano
  CRC: 'CRC', // Colón costarricense
  GTQ: 'GTQ', // Quetzal guatemalteco
  HNL: 'HNL', // Lempira hondureño
  NIO: 'NIO', // Córdoba nicaragüense
  JPY: 'JPY', // Yen japonés (0 decimales — ISO 4217)
  CNY: 'CNY', // Yuan chino (renminbi)
} as const

/** Tipo unión de los códigos aceptados. Un string que NO esté acá no es una moneda válida. */
export type CurrencyCode = (typeof CurrencyCode)[keyof typeof CurrencyCode]

/** Monedas soportadas como array (para iterar / popular selects). */
export const CURRENCY_CODES = Object.values(CurrencyCode) as readonly CurrencyCode[]

/** Metadata por moneda: simbolos, decimales (para Intl.NumberFormat), labels es/en. */
export interface CurrencyMeta {
  code: CurrencyCode
  /** Símbolo compacto para UI (RD$, R$, US$). Para formatCurrency usar Intl, no este símbolo. */
  symbol: string
  /** Decimales según ISO 4217 (CLP/JPY = 0; resto LATAM/USD/EUR = 2). */
  decimals: number
  /** Etiqueta en español para selects. */
  labelEs: string
  /** Etiqueta en inglés (JSON-LD, server-tracking). */
  labelEn: string
}

/**
 * Tabla de metadata. Si agregás un code a CURRENCY_CODES, agregá su fila acá o getCurrencyMeta
 * caerá al fallback USD (con warning en runtime). El orden de CURRENCIES es el del array
 * CURRENCY_CODES (determinístico para selects).
 *
 * Nota: `META` se declara ANTES que `CURRENCIES` porque este último la referencia en el
 * module-load (TDZ — `const` no se hoisteda como `function`). No la muevas de orden.
 */
const META: Record<CurrencyCode, Omit<CurrencyMeta, 'code'>> = {
  USD: { symbol: 'US$', decimals: 2, labelEs: 'Dólar', labelEn: 'US Dollar' },
  EUR: { symbol: '€', decimals: 2, labelEs: 'Euro', labelEn: 'Euro' },
  DOP: { symbol: 'RD$', decimals: 2, labelEs: 'Peso Dominicano', labelEn: 'Dominican Peso' },
  MXN: { symbol: 'MX$', decimals: 2, labelEs: 'Peso Mexicano', labelEn: 'Mexican Peso' },
  COP: { symbol: 'COL$', decimals: 2, labelEs: 'Peso Colombiano', labelEn: 'Colombian Peso' },
  ARS: { symbol: 'AR$', decimals: 2, labelEs: 'Peso Argentino', labelEn: 'Argentine Peso' },
  BRL: { symbol: 'R$', decimals: 2, labelEs: 'Real Brasileño', labelEn: 'Brazilian Real' },
  PEN: { symbol: 'S/', decimals: 2, labelEs: 'Sol Peruano', labelEn: 'Peruvian Sol' },
  CLP: { symbol: 'CLP$', decimals: 0, labelEs: 'Peso Chileno', labelEn: 'Chilean Peso' },
  GBP: { symbol: '£', decimals: 2, labelEs: 'Libra Esterlina', labelEn: 'British Pound' },
  CAD: { symbol: 'CA$', decimals: 2, labelEs: 'Dólar Canadiense', labelEn: 'Canadian Dollar' },
  CHF: { symbol: 'CHF', decimals: 2, labelEs: 'Franco Suizo', labelEn: 'Swiss Franc' },
  // Hardening go-live — 10 monedas LATAM/Asia (ISO 4217 decimals).
  UYU: { symbol: '$U', decimals: 2, labelEs: 'Peso Uruguayo', labelEn: 'Uruguayan Peso' },
  PYG: { symbol: '₲', decimals: 0, labelEs: 'Guaraní', labelEn: 'Paraguayan Guaraní' },
  BOB: { symbol: 'Bs', decimals: 2, labelEs: 'Boliviano', labelEn: 'Bolivian Boliviano' },
  VES: { symbol: 'Bs.S', decimals: 2, labelEs: 'Bolívar Venezolano', labelEn: 'Venezuelan Bolívar' },
  CRC: { symbol: '₡', decimals: 2, labelEs: 'Colón Costarricense', labelEn: 'Costa Rican Colón' },
  GTQ: { symbol: 'Q', decimals: 2, labelEs: 'Quetzal', labelEn: 'Guatemalan Quetzal' },
  HNL: { symbol: 'L', decimals: 2, labelEs: 'Lempira', labelEn: 'Honduran Lempira' },
  NIO: { symbol: 'C$', decimals: 2, labelEs: 'Córdoba', labelEn: 'Nicaraguan Córdoba' },
  JPY: { symbol: '¥', decimals: 0, labelEs: 'Yen Japonés', labelEn: 'Japanese Yen' },
  CNY: { symbol: '¥', decimals: 2, labelEs: 'Yuan Chino', labelEn: 'Chinese Yuan' },
}

export const CURRENCIES: readonly CurrencyMeta[] = CURRENCY_CODES.map((code) => ({ code, ...META[code] }))

/**
 * Type guard: valida que un string arbitrario (de API, DB, query param) sea una moneda aceptada.
 * Úsalo en los bordes del sistema (parseo de req.query, lectura de configuration) para acotar
 * `string` → `CurrencyCode`. Ej: `if (isValidCurrency(q)) { ... }`.
 */
export function isValidCurrency(code: string): code is CurrencyCode {
  return typeof code === 'string' && (CURRENCY_CODES as readonly string[]).includes(code.toUpperCase())
}

/**
 * Devuelve metadata o fallback USD (sin tirar). El fallback existe porque datos externos (APIs,
 * seeds viejos) pueden traer monedas que no tenemos en el catálogo y no queremos romper el flujo
 * — loguea nada más. Si llegás acá en un test, probablemente falte agregar el code a CURRENCY_CODES.
 */
export function getCurrencyMeta(code: string): CurrencyMeta {
  const upper = code?.toUpperCase()
  const found = (CURRENCIES as readonly CurrencyMeta[]).find((m) => m.code === upper)
  if (found) return found
  return { code: 'USD', symbol: 'US$', decimals: 2, labelEs: 'Dólar', labelEn: 'US Dollar' }
}

/**
 * Formatea un monto con Intl.NumberFormat usando el code + los decimales correctos para la moneda.
 * - `locale` default 'es' (formato LATAM). Para JSON-LD/server-tracking pasar 'en'.
 * - CLP sale sin decimales automáticamente (decimals: 0 en META).
 * - Si `code` no es válido, degrada a USD (no rompe).
 *
 * Ej: formatCurrency(1234.5, 'DOP') → '1.234,50 US$' (en es)
 *     formatCurrency(1234.5, 'CLP') → '1.235'       (sin decimales)
 *     formatCurrency(1234.5, 'USD', 'en') → '$1,234.50'
 */
export function formatCurrency(amount: number, code: string, locale = 'es'): string {
  const meta = getCurrencyMeta(code)
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: meta.code,
      minimumFractionDigits: meta.decimals,
      maximumFractionDigits: meta.decimals,
    }).format(amount)
  } catch {
    // Si Intl no reconoce la moneda (no debería pasar por el fallback USD), devolvemos monto crudo.
    return `${meta.symbol} ${amount.toFixed(meta.decimals)}`
  }
}
