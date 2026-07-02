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
    const params = hotelId ? `?hotelId=${hotelId}` : ''
    const config = await http.get<{ value: CurrencyConfig }>(`/settings/currency${params}`)
    if (config?.value) {
      currencyConfig.value = {
        secondaryCurrency: config.value.secondaryCurrency || '',
        exchangeRate: Number(config.value.exchangeRate) || 0,
      }
    }
  } catch { /* silent */ }
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

/**
 * Formatea un monto con su moneda.
 */
export function formatCurrency(amount: number, currency: string): string {
  const symbols: Record<string, string> = {
    USD: '$', DOP: 'RD$', EUR: '€', COP: '$', MXN: '$', ARS: '$', CLP: '$',
  }
  const symbol = symbols[currency] || currency + ' '
  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
