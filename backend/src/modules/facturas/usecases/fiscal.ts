// facturas/usecases/fiscal.ts — Numeración fiscal (NCF) y adaptador de facturación electrónica.
//
// NCF: número de Comprobante Fiscal (LATAM). Formato por país, configurable en
// configuration(key='electronic_invoicing'). Ej RD: serie "E31" + secuencia 11 dígitos.
//
// FiscalAdapter: interfaz para enviar el comprobante a la autoridad (DGII/DIAN/SAT/...).
// La implementación live requiere credenciales y certificados del país — acá se deja la
// estructura con un adapter de prueba (stub) que simula el envío. `issueNcf` SÍ llama al
// adapter (antes stubFiscalAdapter existía pero create-invoice.ts nunca lo invocaba: el NCF
// se generaba y ahí terminaba, sin ningún intento de transmisión, ni siquiera simulado).

import type { RepositoryAdapter } from 'arckode-framework'

export interface NcfConfig {
  enabled?: boolean
  serie?: string        // p.ej. "E31" (RD), "FE" (Colombia), "I" (México)
  sequence?: number     // próximo número
  authority?: string    // 'DGII' | 'DIAN' | 'SAT' | 'SUNAT' | 'SII' | 'AFIP' | 'none'
}

/** Construye el próximo NCF según la config del hotel. No muta la secuencia (eso lo hace issueNcf). */
export function buildNcf(cfg: NcfConfig | null | undefined, seq: number): string {
  const serie = cfg?.serie || 'E31'
  const auth = cfg?.authority || 'MANUAL'
  if (!cfg?.enabled) return `${auth}-${Date.now()}`
  const padded = String(seq).padStart(11, '0')
  return `${serie}${auth === 'DGII' ? '' : '-' }${padded}`.replace('--', '-')
}

export interface FiscalTransmission {
  sent: boolean
  ack?: string
  xml?: string
  message?: string
}

export interface FiscalInvoiceInput {
  hotelId: string
  invoiceNumber: string
  ncf: string
  amount: number
  taxes: number
  currency: string
  guestId?: string | null
}

/** Adapter de facturación electrónica. Implementación real va por país (DGII/DIAN/SAT/...). */
export interface FiscalAdapter {
  /** Envía el comprobante ya numerado (ncf) a la autoridad fiscal del país. */
  issue(invoice: FiscalInvoiceInput, cfg: NcfConfig): Promise<FiscalTransmission>
}

/** Stub: simula el envío (siempre `sent:false`). Útil hasta conectar credenciales reales del país. */
export const stubFiscalAdapter: FiscalAdapter = {
  async issue(invoice, cfg) {
    return {
      sent: false,
      message: `Pendiente de envío a ${cfg.authority || 'la autoridad fiscal'} (configurar credenciales) — NCF ${invoice.ncf}`,
    }
  },
}

export interface NcfIssueResult {
  ncf: string | null
  fiscalSent: boolean
  fiscalMessage: string | null
}

/**
 * DT-03 + mejora (2026-07-29): emite el próximo NCF SOLO si el hotel tiene facturación
 * electrónica activa (configuration key='electronic_invoicing', value.enabled) — si no está
 * activa, devuelve `ncf: null` (antes se asignaba `NCF-{n}` a todas, lo que ensuciaba el
 * criterio de borrado y simulaba comprobantes inexistentes). Incrementa la secuencia de forma
 * atómica sobre la misma config row (correlatividad fiscal).
 *
 * Además INTENTA transmitir el comprobante vía `adapter` (stub por defecto): antes esto era
 * código sin usar, ahora la factura queda con `fiscalSent`/`fiscalMessage` reales en vez de no
 * decir nada sobre si el comprobante llegó a la autoridad.
 *
 * Si la transmisión falla (el adapter tira), el NCF ya consumió su número de secuencia — se
 * conserva igual (no se pierde ni se reutiliza) y la factura queda marcada `fiscalSent:false`
 * con el motivo, en vez de descartar el número.
 */
export async function issueNcf(
  configRepo: RepositoryAdapter<any>,
  hotelId: string,
  invoice: Omit<FiscalInvoiceInput, 'ncf'>,
  adapter: FiscalAdapter = stubFiscalAdapter,
): Promise<NcfIssueResult> {
  let cfgRow: any
  let cfg: NcfConfig | undefined
  try {
    cfgRow = await configRepo.findOne({ hotelId, key: 'electronic_invoicing' })
    cfg = cfgRow?.value as NcfConfig | undefined
  } catch {
    return { ncf: null, fiscalSent: false, fiscalMessage: null }
  }
  if (!cfg?.enabled) return { ncf: null, fiscalSent: false, fiscalMessage: null }

  const nextSeq = (Number(cfg.sequence) || 0) + 1
  try {
    if (cfgRow) await configRepo.update(cfgRow.id, { value: { ...cfg, sequence: nextSeq } } as any)
  } catch {
    return { ncf: null, fiscalSent: false, fiscalMessage: null }
  }
  const ncf = buildNcf(cfg, nextSeq)

  try {
    const transmission = await adapter.issue({ ...invoice, ncf }, cfg)
    return { ncf, fiscalSent: transmission.sent, fiscalMessage: transmission.message ?? null }
  } catch (err) {
    return {
      ncf,
      fiscalSent: false,
      fiscalMessage: err instanceof Error ? err.message : 'Error al transmitir a la autoridad fiscal',
    }
  }
}
