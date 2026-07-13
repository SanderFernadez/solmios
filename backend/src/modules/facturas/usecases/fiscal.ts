// facturas/usecases/fiscal.ts — Numeración fiscal (NCF) y adaptador de facturación electrónica.
//
// NCF: número de Comprobante Fiscal (LATAM). Formato por país, configurable en
// configuration(key='electronic_invoicing'). Ej RD: serie "E31" + secuencia 11 dígitos.
//
// FiscalAdapter: interfaz para enviar el comprobante a la autoridad (DGII/DIAN/SAT/...).
// La implementación live requiere credenciales y certificados del país — acá se deja la
// estructura con un adapter de prueba (stub) que simula el envío.

import type { RepositoryAdapter } from 'arckode-framework'
import type { FacturasDTO } from '../types'

export interface NcfConfig {
  enabled?: boolean
  serie?: string        // p.ej. "E31" (RD), "FE" (Colombia), "I" (México)
  sequence?: number     // próximo número
  authority?: string    // 'DGII' | 'DIAN' | 'SAT' | 'SUNAT' | 'SII' | 'AFIP' | 'none'
}

export interface FiscalResult {
  ncf: string
  sent: boolean
  ack?: string
  xml?: string
  message?: string
}

/**
 * DT-03: Emite el próximo NCF SOLO si el hotel tiene facturación electrónica activa
 * (configuration key='electronic_invoicing', value.enabled). Si no está activa, devuelve
 * `null` — la factura no lleva comprobante fiscal (antes se asignaba `NCF-{n}` a todas,
 * lo que ensuciaba el criterio de borrado y simulaba comprobantes inexistentes).
 *
 * Incrementa la secuencia de forma atómica sobre la misma config row (correlatividad fiscal).
 */
export async function nextNcf(
  configRepo: RepositoryAdapter<any>,
  hotelId: string,
): Promise<string | null> {
  try {
    const cfgRow = await configRepo.findOne({ hotelId, key: 'electronic_invoicing' })
    const cfg = cfgRow?.value as NcfConfig | undefined
    if (!cfg?.enabled) return null

    const nextSeq = (Number(cfg.sequence) || 0) + 1
    if (cfgRow) await configRepo.update(cfgRow.id, { value: { ...cfg, sequence: nextSeq } } as any)
    return buildNcf(cfg, nextSeq)
  } catch {
    return null
  }
}

/** Construye el próximo NCF según la config del hotel. No muta la secuencia (eso lo hace el adapter al enviar). */
export function buildNcf(cfg: NcfConfig | null | undefined, seq: number): string {
  const serie = cfg?.serie || 'E31'
  const auth = cfg?.authority || 'MANUAL'
  if (!cfg?.enabled) return `${auth}-${Date.now()}`
  const padded = String(seq).padStart(11, '0')
  return `${serie}${auth === 'DGII' ? '' : '-' }${padded}`.replace('--', '-')
}

/** Adapter de facturación electrónica. Implementación real va por país (DGII/DIAN/SAT/...). */
export interface FiscalAdapter {
  /** Envía el comprobante a la autoridad y devuelve el ACK + NCF definitivo. */
  issue(invoice: FacturasDTO, cfg: NcfConfig): Promise<FiscalResult>
}

/** Stub: simula el envío. Útil hasta conectar credenciales reales del país. */
export const stubFiscalAdapter: FiscalAdapter = {
  async issue(invoice, cfg) {
    const seq = (cfg?.sequence ?? 1)
    const ncf = buildNcf(cfg, seq)
    return {
      ncf,
      sent: false,
      message: cfg?.enabled
        ? `Pendiente de envío a ${cfg.authority || 'autoridad'} (configurar credenciales)`
        : 'Facturación electrónica deshabilitada — NCF local',
    }
  },
}
