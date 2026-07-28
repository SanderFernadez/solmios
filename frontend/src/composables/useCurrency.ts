// composables/useCurrency.ts — Utilidad de conversión de moneda para frontend.
// Lee la config de moneda del hotel y proporciona funciones de conversión y formato.

import { ref, computed } from 'vue'
import { http } from '@/services/http'

export interface CurrencyConfig {
  secondaryCurrency: string
  exchangeRate: number
}

const currencyConfig = ref<CurrencyConfig>({ secondaryCurrency: '', exchangeRate: 0 })
const loaded = ref(false)

/**
 * Carga la configuración de moneda del hotel actual.
 */
export async function loadCurrencyConfig(hotelId?: string): Promise<CurrencyConfig> {
  if (loaded.value) return currencyConfig.value
  try {
    // `/settings/currency` nunca existió en el backend (404 silencioso). El endpoint genérico de
    // config por key es `/configuracion/:key` (devuelve `{valor}`, no `{value}` — inconsistencia
    // de nombres con otros endpoints, no se toca acá, solo se lee correctamente).
    const params = hotelId ? `?hotelId=${hotelId}` : ''
    const config = await http.get<{ valor: CurrencyConfig | null }>(`/configuracion/currency${params}`)
    if (config?.valor) {
      currencyConfig.value = {
        secondaryCurrency: config.valor.secondaryCurrency || '',
        exchangeRate: Number(config.valor.exchangeRate) || 0,
      }
    }
  } catch { /* silent: sin config de moneda secundaria configurada, se usa el default vacío */ }
  loaded.value = true
  return currencyConfig.value
}

/**
 * Convierte un monto usando el tipo de cambio configurado.
 */
export function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  exchangeRate: number,
): number {
  if (fromCurrency === toCurrency || !exchangeRate) return amount
  return Math.round((amount * exchangeRate + Number.EPSILON) * 100) / 100
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', DOP: 'RD$', EUR: '€', COP: '$', MXN: '$', ARS: '$', CLP: '$',
}

/**
 * Símbolo de la moneda. Se expone aparte de `formatCurrency` para los componentes que reciben
 * el prefijo y el número por separado (KpiHeroCard anima el valor, así que no puede recibirlo
 * ya formateado). Evita que las vistas hardcodeen '$' cuando el hotel factura en otra moneda.
 */
export function currencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] || currency + ' '
}

/**
 * Formatea un monto con su moneda.
 */
export function formatCurrency(amount: number, currency: string): string {
  return `${currencySymbol(currency)}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Composable para usar en componentes.
 */
export function useCurrency(hotelCurrency: string = 'USD') {
  const config = currencyConfig

  const secondaryCurrency = computed(() => config.value.secondaryCurrency)
  const exchangeRate = computed(() => config.value.exchangeRate)

  function convert(amount: number, toSecondary = true): number {
    if (!toSecondary || !secondaryCurrency.value || !exchangeRate.value) return amount
    return convertAmount(amount, hotelCurrency, secondaryCurrency.value, exchangeRate.value)
  }

  function format(amount: number, currency = hotelCurrency): string {
    return formatCurrency(amount, currency)
  }

  function formatSecondary(amount: number): string {
    if (!secondaryCurrency.value) return ''
    return formatCurrency(convert(amount), secondaryCurrency.value)
  }

  return {
    config,
    secondaryCurrency,
    exchangeRate,
    convert,
    format,
    formatSecondary,
    loadCurrencyConfig,
  }
}
