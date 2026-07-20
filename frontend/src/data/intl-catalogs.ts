// Catálogos de zonas horarias y monedas derivados del runtime (Intl), NO escritos a mano.
//
// Por qué: la configuración del hotel traía 6 zonas horarias y 7 monedas hardcodeadas en el .vue,
// todas latinoamericanas. Un hotel en España o Japón no podía elegir la suya. Mantener una lista
// propia significa que se desactualiza sola (husos que cambian, monedas que se redenominan), así
// que se toma la del motor: `Intl.supportedValuesOf` da 418 husos y 162 monedas, y se actualiza
// con el navegador.
//
// El fallback cubre navegadores sin `supportedValuesOf` (Chrome <99 / Safari <15.4): se degrada a
// la zona del propio equipo y a un puñado de monedas, en vez de dejar el selector vacío.

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

export const CURRENCIES: { value: string; label: string }[] = (() => {
  const codes = supported('currency')
  const list = codes.length ? codes : ['DOP', 'USD', 'EUR', 'COP', 'MXN', 'PEN', 'CLP', 'ARS']
  return list.map((c) => ({ value: c, label: currencyLabel(c) }))
})()
