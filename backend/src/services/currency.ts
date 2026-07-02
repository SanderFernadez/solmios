// services/currency.ts — Utilidad de conversión de moneda multi-tenant.
// Lee la config de moneda del hotel desde Configuration (key: currency_config).
// Proporciona funciones de conversión y formato.

import type { RepositoryAdapter } from 'arckode-framework'

export interface CurrencyConfig {
  secondaryCurrency: string
  exchangeRate: number
}

export interface CurrencyResult {
  amount: number
  currency: string
  convertedAmount?: number
  convertedCurrency?: string
  exchangeRate?: number
}

/**
 * Obtiene la configuración de moneda del hotel.
 */
export async function getCurrencyConfig(
  configRepo: RepositoryAdapter<any>,
  hotelId: string,
): Promise<CurrencyConfig> {
  try {
    const config = await configRepo.findOne({ hotelId, key: 'currency_config' })
    if (config?.value) {
      const val = typeof config.value === 'string' ? JSON.parse(config.value) : config.value
      return {
        secondaryCurrency: val.secondaryCurrency || '',
        exchangeRate: Number(val.exchangeRate) || 0,
      }
    }
  } catch { /* silent */ }
  return { secondaryCurrency: '', exchangeRate: 0 }
}

/**
 * Convierte un monto de una moneda a otra usando el tipo de cambio configurado.
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
 * Obtiene el símbolo de una moneda.
 */
export function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    USD: '$', DOP: 'RD$', EUR: '€', COP: '$', MXN: '$', ARS: '$', CLP: '$',
  }
  return symbols[currency] || currency + ' '
}
