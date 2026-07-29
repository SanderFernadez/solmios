// facturas/usecases/invoice-template.ts — Template HTML A4 para factura imprimible/PDF.
// Genera HTML válido A4 (210mm x 297mm) que el navegador puede imprimir a PDF.

import type { FacturasDTO } from '../types'
import { CurrencyCode } from '../../../shared/currency'

export interface InvoiceTemplateData {
  invoice: FacturasDTO
  hotelName?: string
  hotelAddress?: string
  hotelPhone?: string
  hotelEmail?: string
  hotelLogo?: string
  hotelTaxId?: string
}

const STATUS_LABELS: Record<string, string> = {
  paid: 'PAGADA', pending: 'PENDIENTE', overdue: 'VENCIDA', cancelled: 'ANULADA', draft: 'BORRADOR',
}
const TYPE_LABELS: Record<string, string> = {
  invoice: 'FACTURA', payment: 'COMPROBANTE DE PAGO', folio: 'CARGO', receipt: 'RECIBO', credit_note: 'NOTA DE CRÉDITO',
}

export function renderInvoiceHtml(data: InvoiceTemplateData): string {
  const {
    invoice: inv,
    hotelName = 'Hotel',
    hotelAddress = '',
    hotelPhone = '',
    hotelEmail = '',
    hotelLogo = '',
    hotelTaxId = '',
  } = data

  // Construir items desde los datos disponibles
  let items = inv.items?.length ? inv.items : []

  // Si no hay items, intentar extraer del notes o crear descripción meaningful
  if (!items.length) {
    const notes = inv.notes || ''
    // Parsear notes: "Folio abc123 · 3 cargo(s) · Carlos Mendoza · Hab 101"
    const folioMatch = notes.match(/Folio\s+\w+/i)
    const cargoMatch = notes.match(/(\d+)\s+cargo/i)
    const guestMatch = notes.match(/·\s*(.+?)(?:\s*·|$)/)
    const roomMatch = notes.match(/Hab\s+(\w+)/i)

    // Detectar tipo de cargo desde notes o contexto
    let description = TYPE_LABELS[inv.type] || 'Servicio'
    if (notes.toLowerCase().includes('minibar')) description = 'Minibar'
    else if (notes.toLowerCase().includes('restaurante') || notes.toLowerCase().includes('restaurant')) description = 'Restaurante'
    else if (notes.toLowerCase().includes('spa')) description = 'Spa'
    else if (notes.toLowerCase().includes('lavanderia') || notes.toLowerCase().includes('lavandería')) description = 'Lavandería'
    else if (notes.toLowerCase().includes('habitacion') || notes.toLowerCase().includes('hospedaje')) description = 'Hospedaje'
    else if (notes.toLowerCase().includes('telefono') || notes.toLowerCase().includes('teléfono')) description = 'Telefonía'
    else if (notes.toLowerCase().includes('servicio de habitación') || notes.toLowerCase().includes('room service')) description = 'Servicio de Habitación'
    else if (cargoMatch) description = `${cargoMatch[1]} servicio(s) del folio`
    else if (folioMatch) description = 'Cargos del folio'

    items = [{ description, amount: Number(inv.amount) || 0 }]
  }

  const subtotal = inv.subtotal ?? (Number(inv.amount) - Number(inv.taxes))
  const balance = Number(inv.amount) - Number(inv.amountPaid || 0)

  const itemsHtml = items.map((item, i) => `
      <tr>
        <td style="padding:7px 12px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#475569;">${i + 1}</td>
        <td style="padding:7px 12px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#1e293b;">${escapeHtml(item.description)}</td>
        <td style="padding:7px 12px;border-bottom:1px solid #e2e8f0;font-size:11px;text-align:right;color:#1e293b;">${Number(item.amount).toFixed(2)}</td>
      </tr>`).join('')

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${TYPE_LABELS[inv.type] || 'Factura'} ${escapeHtml(inv.invoiceNumber)}</title>
<style>
  @page { size: A4; margin: 15mm 20mm; }
  @media print { body { margin: 0; padding: 0; } .no-print { display: none !important; } }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
    color: #1e293b;
    background: #fff;
    width: 210mm;
    min-height: 297mm;
    padding: 15mm 20mm;
    font-size: 11px;
    line-height: 1.5;
  }

  /* ─── Header ─── */
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 3px solid #0f3460; margin-bottom: 20px; }
  .hotel-logo { max-height: 40px; margin-bottom: 6px; }
  .hotel-name { font-size: 20px; font-weight: 800; color: #0f3460; letter-spacing: -0.5px; }
  .hotel-detail { font-size: 9px; color: #64748b; margin-top: 2px; }
  .doc-box { text-align: right; }
  .doc-type { font-size: 22px; font-weight: 900; color: #0f3460; letter-spacing: 2px; }
  .doc-number { font-size: 13px; font-weight: 700; color: #334155; margin-top: 4px; }
  .doc-date { font-size: 10px; color: #64748b; margin-top: 2px; }

  /* ─── NCF ─── */
  .ncf-bar { background: #fef3c7; border: 1px solid #fbbf24; border-radius: 6px; padding: 8px 14px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
  .ncf-label { font-size: 10px; font-weight: 700; color: #92400e; text-transform: uppercase; }
  .ncf-value { font-size: 12px; font-weight: 800; color: #78350f; }

  /* ─── Status ─── */
  .status-badge { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
  .status-paid { background: #dcfce7; color: #166534; }
  .status-pending { background: #fef9c3; color: #854d0e; }
  .status-overdue { background: #fee2e2; color: #991b1b; }
  .status-cancelled { background: #f1f5f9; color: #475569; }
  .status-draft { background: #f1f5f9; color: #64748b; }

  /* ─── Parties ─── */
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
  .party-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; }
  .party-label { font-size: 8px; text-transform: uppercase; color: #94a3b8; font-weight: 700; letter-spacing: 1px; margin-bottom: 4px; }
  .party-name { font-size: 13px; font-weight: 700; color: #0f3460; }
  .party-detail { font-size: 10px; color: #64748b; margin-top: 2px; }

  /* ─── Table ─── */
  .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  .items-table th { background: #0f3460; color: #fff; padding: 8px 12px; font-size: 9px; text-transform: uppercase; text-align: left; font-weight: 700; letter-spacing: 0.5px; }
  .items-table th:first-child { width: 30px; text-align: center; }
  .items-table th:last-child { text-align: right; }
  .items-table tbody tr:nth-child(even) { background: #f8fafc; }

  /* ─── Totals ─── */
  .totals-section { display: flex; justify-content: flex-end; margin-bottom: 20px; }
  .totals-box { width: 260px; }
  .totals-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 11px; color: #475569; }
  .totals-divider { border-top: 1px solid #e2e8f0; margin: 6px 0; }
  .totals-row.total { font-size: 14px; font-weight: 800; color: #0f3460; padding: 6px 0; }
  .totals-row.paid { color: #166534; }
  .totals-row.balance { color: #b45309; font-weight: 700; }

  /* ─── Payment Info ─── */
  .payment-info { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 14px; margin-bottom: 16px; }
  .payment-info-title { font-size: 10px; font-weight: 700; color: #166534; text-transform: uppercase; margin-bottom: 6px; }
  .payment-detail { font-size: 10px; color: #475569; }

  /* ─── Notes ─── */
  .notes { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; margin-bottom: 16px; }
  .notes-title { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
  .notes-text { font-size: 10px; color: #475569; white-space: pre-wrap; }

  /* ─── Footer ─── */
  .footer { border-top: 2px solid #0f3460; padding-top: 12px; margin-top: 20px; }
  .footer-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
  .footer-col { text-align: center; }
  .footer-label { font-size: 8px; text-transform: uppercase; color: #94a3b8; font-weight: 700; letter-spacing: 0.5px; }
  .footer-line { width: 60%; height: 1px; background: #cbd5e1; margin: 20px auto 4px; }
  .footer-value { font-size: 9px; color: #475569; }

  /* ─── Print Button ─── */
  .print-btn { position: fixed; top: 16px; right: 16px; background: #0f3460; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 12px; box-shadow: 0 4px 12px rgba(15,52,96,0.3); z-index: 100; }
  .print-btn:hover { background: #1a4a7a; }
</style>
</head>
<body>
<button class="print-btn no-print" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>

<!-- Header -->
<div class="header">
  <div>
    ${hotelLogo ? `<img src="${escapeHtml(hotelLogo)}" alt="Logo" class="hotel-logo">` : ''}
    <div class="hotel-name">${escapeHtml(hotelName)}</div>
    ${hotelAddress ? `<div class="hotel-detail">${escapeHtml(hotelAddress)}</div>` : ''}
    ${hotelPhone ? `<div class="hotel-detail">Tel: ${escapeHtml(hotelPhone)}</div>` : ''}
    ${hotelEmail ? `<div class="hotel-detail">${escapeHtml(hotelEmail)}</div>` : ''}
    ${hotelTaxId ? `<div class="hotel-detail">RNC: ${escapeHtml(hotelTaxId)}</div>` : ''}
  </div>
  <div class="doc-box">
    <div class="doc-type">${TYPE_LABELS[inv.type] || 'FACTURA'}</div>
    <div class="doc-number">N° ${escapeHtml(inv.invoiceNumber)}</div>
    <div class="doc-date">Fecha: ${formatDate(inv.issueDate)}</div>
    ${inv.dueDate ? `<div class="doc-date">Vence: ${formatDate(inv.dueDate)}</div>` : ''}
    <div style="margin-top:6px;">
      <span class="status-badge status-${inv.status}">${STATUS_LABELS[inv.status] || inv.status}</span>
    </div>
  </div>
</div>

${inv.ncf ? `
<div class="ncf-bar">
  <span class="ncf-label">NCF (Número de Comprobante Fiscal)</span>
  <span class="ncf-value">${escapeHtml(inv.ncf)}</span>
</div>` : ''}

<!-- Parties -->
<div class="parties">
  <div class="party-box">
    <div class="party-label">Cliente / Huésped</div>
    <div class="party-name">${escapeHtml(inv.guest || 'Cliente General')}</div>
    ${inv.room ? `<div class="party-detail">Habitación: ${escapeHtml(inv.room)}</div>` : ''}
    ${inv.reservationId ? `<div class="party-detail">Reserva: ${escapeHtml(inv.reservationId.slice(0, 8))}</div>` : ''}
  </div>
  <div class="party-box">
    <div class="party-label">Detalles del Documento</div>
    <div class="party-detail">Moneda: <strong>${escapeHtml(inv.currency || CurrencyCode.USD)}</strong></div>
    <div class="party-detail">Tipo: <strong>${TYPE_LABELS[inv.type] || inv.type}</strong></div>
    ${inv.paymentMethod ? `<div class="party-detail">Método: <strong>${escapeHtml(inv.paymentMethod)}</strong></div>` : ''}
  </div>
</div>

<!-- Items Table -->
<table class="items-table">
  <thead>
    <tr>
      <th>#</th>
      <th>Descripción</th>
      <th style="text-align:right;">Monto (${escapeHtml(inv.currency || CurrencyCode.USD)})</th>
    </tr>
  </thead>
  <tbody>
    ${itemsHtml}
  </tbody>
</table>

<!-- Totals -->
<div class="totals-section">
  <div class="totals-box">
    <div class="totals-row">
      <span>Subtotal</span>
      <span>${formatMoney(subtotal, inv.currency)}</span>
    </div>
    <div class="totals-row">
      <span>Impuestos (${inv.taxRate ?? 0}%)</span>
      <span>${formatMoney(inv.taxes, inv.currency)}</span>
    </div>
    <div class="totals-divider"></div>
    <div class="totals-row total">
      <span>TOTAL</span>
      <span>${formatMoney(inv.amount, inv.currency)}</span>
    </div>
    ${(inv.amountPaid ?? 0) > 0 ? `
    <div class="totals-row paid">
      <span>Pagado</span>
      <span>-${formatMoney(inv.amountPaid, inv.currency)}</span>
    </div>
    <div class="totals-row balance">
      <span>Saldo Pendiente</span>
      <span>${formatMoney(balance, inv.currency)}</span>
    </div>` : ''}
  </div>
</div>

${inv.paymentMethod ? `
<div class="payment-info">
  <div class="payment-info-title">Información de Pago</div>
  <div class="payment-detail">Método: <strong>${escapeHtml(inv.paymentMethod)}</strong></div>
  ${(inv.amountPaid ?? 0) > 0 ? `<div class="payment-detail">Monto pagado: <strong>${formatMoney(inv.amountPaid, inv.currency)}</strong></div>` : ''}
</div>` : ''}

${inv.notes ? `
<div class="notes">
  <div class="notes-title">Notas / Observaciones</div>
  <div class="notes-text">${escapeHtml(inv.notes)}</div>
</div>` : ''}

<!-- Footer -->
<div class="footer">
  <div class="footer-grid">
    <div class="footer-col">
      <div class="footer-label">Elaborado por</div>
      <div class="footer-line"></div>
      <div class="footer-value">${escapeHtml(hotelName)}</div>
    </div>
    <div class="footer-col">
      <div class="footer-label">Firma del Cliente</div>
      <div class="footer-line"></div>
      <div class="footer-value">${escapeHtml(inv.guest || '')}</div>
    </div>
    <div class="footer-col">
      <div class="footer-label">Fecha de Emisión</div>
      <div class="footer-line"></div>
      <div class="footer-value">${formatDate(inv.issueDate)}</div>
    </div>
  </div>
  <div style="text-align:center;margin-top:16px;font-size:8px;color:#94a3b8;">
    ${escapeHtml(hotelName)} — ${escapeHtml(hotelAddress)} — Tel: ${escapeHtml(hotelPhone)} — ${escapeHtml(hotelEmail)}
    <br>Documento generado automáticamente el ${new Date().toLocaleString('es-DO')}
  </div>
</div>

</body>
</html>`
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('es-DO', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch { return String(dateStr) }
}

function formatMoney(amount?: number | null, currency: string = CurrencyCode.USD): string {
  const n = Number(amount) || 0
  return `${currency} ${n.toFixed(2)}`
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
