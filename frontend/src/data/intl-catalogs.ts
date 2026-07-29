// Catálogos de zonas horarias y monedas derivados del runtime (Intl), NO escritos a mano.
//
// Por qué: la configuración del hotel traía 6 zonas horarias y 7 monedas hardcodeadas en el .vue,
// todas latinoamericanas. Un hotel en España o Japón no podía elegir la suya. Mantener una lista
// propia significa que se desactualiza sola (husos que cambian, monedas que se redenominan), así
// que se toma la del motor: `Intl.supportedValuesOf` da 418 husos y 162 monedas, y se actualiza
// con el navegador.
//
// El fallback cubre navegadores sin `supportedValuesOf` (Chrome <99 / Safari <15.4): se degrada a
// la zona del propio equipo y al enum global de monedas (`CURRENCY_CODES` del source of truth en
// `types/currency.ts`), en vez de dejar el selector vacío.
//
// Nota sobre el enum: este archivo re-exporta `CurrencyCode`, los helpers (`isValidCurrency`,
// `getCurrencyMeta`, `formatCurrency`) y la metadata (`CURRENCIES` del enum) desde `types/currency`.
// Cuando un componente necesita la lista COMPLETA del motor (select de configuración del hotel),
// usa `CURRENCIES` de acá (runtime list, {value,label}). Cuando necesita la metadata canonica
// (símbolo, decimales) o un type guard, usa `CURRENCIES_META` / los helpers del enum.

import {
  CURRENCY_CODES,
  CurrencyCode,
  type CurrencyMeta,
  getCurrencyMeta,
  isValidCurrency,
  formatCurrency,
} from '@/types/currency'

// Re-export del enum global (source of truth único).
// `CurrencyCode` es BOTH un valor (objeto enum-like) Y un tipo (unión de sus keys), por eso
// se exporta SIN `type` — si lo declarás type-only, los consumers no pueden hacer `CurrencyCode.USD`
// como valor (TS1362). Para `CurrencyMeta` sí es type-only.
export {
  CURRENCY_CODES,
  CurrencyCode,
  type CurrencyMeta,
  getCurrencyMeta,
  isValidCurrency,
  formatCurrency,
}

// Alias explícito para distinguir la metadata del enum de la lista runtime ({value,label}).
export const CURRENCIES_META: readonly CurrencyMeta[] = (
  // re-import silencioso: CURRENCY_CODES ya está arriba, pero el enum también expone CURRENCIES
  // (metadata). Para evitar doble import, lo derivamos a partir de los codes.
  CURRENCY_CODES.map((c) => getCurrencyMeta(c))
)

/** Etiqueta legible de un huso: 'Europe/Madrid' → 'Europe / Madrid (GMT+2)'. */
function timeZoneLabel(tz: string): string {
  const pretty = tz.replace(/_/g, ' ').replace('/', ' / ')
  try {
    // El offset se calcula contra "ahora": refleja el horario de verano vigente.
    const parts = new Intl.DateTimeFormat('es', { timeZone: tz, timeZoneName: 'shortOffset' })
      .formatToParts(new Date())
    const off = parts.find((p) => p.type === 'timeZoneName')?.value
    return off ? `${pretty} (${off})` : pretty
  } catch {
    return pretty
  }
}

function supported(key: 'timeZone' | 'currency'): string[] {
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf
    return typeof fn === 'function' ? fn(key) : []
  } catch {
    return []
  }
}

/** Zona horaria del equipo — usada como fallback y como sugerencia inicial. */
export function localTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export const TIMEZONES: { value: string; label: string }[] = (() => {
  const zones = supported('timeZone')
  const list = zones.length ? zones : [localTimeZone(), 'UTC']
  return list.map((tz) => ({ value: tz, label: timeZoneLabel(tz) }))
})()

/** Nombre de la moneda en español, si el motor lo conoce: 'EUR' → 'EUR — euro'. */
function currencyLabel(code: string): string {
  try {
    const name = new Intl.DisplayNames(['es'], { type: 'currency' }).of(code)
    return name && name !== code ? `${code} — ${name}` : code
  } catch {
    return code
  }
}

/**
 * Lista de monedas para selects: runtime (`Intl.supportedValuesOf`) si el motor la provee
 * (162 monedas ISO), si no cae al enum global `CURRENCY_CODES` (las 12 del proyecto).
 * Shape `{value,label}` para `<select>` / `<SearchSelect>`.
 */
export const CURRENCIES: { value: string; label: string }[] = (() => {
  const codes = supported('currency')
  const list = codes.length ? codes : (CURRENCY_CODES as readonly string[]).slice()
  return list.map((c) => ({ value: c, label: currencyLabel(c) }))
})()
