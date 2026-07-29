// types/currency.ts — Espejo frontend del source of truth global de monedas.
//
// Source of truth: backend/src/shared/currency.ts — mantener sincronizado.
// Misma lista de codes, misma metadata, mismas firmas que el backend. Cuando agregues una
// moneda nueva, agregala en AMBOS archivos (el backend NO se importa acá para no arrastrar
// deps de node — son archivos standalone duplicados a propósito).
//
// Histórico: antes de este refactor existían 6 enums parciales divergentes (intl-catalogs.ts,
// azul-gateway.ts, useBooking.ts, empleados/index.vue, settings/index.vue, azul-gateway.test.ts)
// + ~230 strings sueltos 'USD'/'EUR'/'DOP'/... en backend y frontend. Ahora todos importan de acá.

/**
 * Enum-like de monedas (ISO 4217) — mismo nombre para valor y tipo, patrón TypeScript
 * recomendado para evitar `const enum` (que tiene issues con isolatedModules/Vite).
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
} as const

/** Tipo unión de los códigos aceptados. Un string que NO esté acá no es una moneda válida. */
export type CurrencyCode = (typeof CurrencyCode)[keyof typeof CurrencyCode]

/** Monedas soportadas como array (para iterar / popular selects). */
export const CURRENCY_CODES = Object.values(CurrencyCode) as readonly CurrencyCode[]

/** Metadata por moneda: símbolo, decimales (para Intl.NumberFormat), labels es/en. */
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
}

/** Tabla de metadata (mismo orden que CURRENCY_CODES — determinístico para selects). */
export const CURRENCIES: readonly CurrencyMeta[] = CURRENCY_CODES.map((code) => ({ code, ...META[code] }))

/**
 * Type guard: valida que un string arbitrario (de API, config, query param) sea una moneda
 * aceptada. Úsalo en los bordes (parseo de payload backend, lectura de config) para acotar
 * `string` → `CurrencyCode`.
 */
export function isValidCurrency(code: string): code is CurrencyCode {
  return typeof code === 'string' && (CURRENCY_CODES as readonly string[]).includes(code.toUpperCase())
}

/**
 * Devuelve metadata o fallback USD (sin tirar). El fallback existe porque datos externos (APIs,
 * seeds viejos) pueden traer monedas que no tenemos en el catálogo — no rompemos el flujo.
 */
export function getCurrencyMeta(code: string): CurrencyMeta {
  const upper = code?.toUpperCase()
  const found = (CURRENCIES as readonly CurrencyMeta[]).find((m) => m.code === upper)
  if (found) return found
  return { code: 'USD', symbol: 'US$', decimals: 2, labelEs: 'Dólar', labelEn: 'US Dollar' }
}

/**
 * Formatea un monto con Intl.NumberFormat usando el code + los decimales correctos.
 * - `locale` default 'es' (formato LATAM). Para JSON-LD pasar 'en'.
 * - CLP sale sin decimales automáticamente (decimals: 0 en META).
 * - Si `code` no es válido, degrada a USD (no rompe).
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
    return `${meta.symbol} ${amount.toFixed(meta.decimals)}`
  }
}
