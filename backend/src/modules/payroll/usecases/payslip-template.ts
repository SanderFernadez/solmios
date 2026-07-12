// payroll/usecases/payslip-template.ts — Recibo de nómina imprimible/PDF (A4).
// El navegador lo imprime a PDF (mismo enfoque que la factura A4). Función pura, sin I/O.

import type { PayrollRunDetailDTO, PayrollRunDTO } from '../types'

interface LineItem { name: string; amount: number }

/** Parsea earnings/deductions (JSON string) de forma tolerante → lista de líneas. */
function parseLines(raw: string | null): LineItem[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.map((x) => ({ name: String(x.name ?? x.label ?? x.code ?? 'Concepto'), amount: Number(x.amount ?? x.value ?? 0) }))
    }
    if (parsed && typeof parsed === 'object') {
      return Object.entries(parsed).map(([name, amount]) => ({ name, amount: Number(amount) || 0 }))
    }
  } catch { /* dato viejo o texto libre → sin líneas detalladas */ }
  return []
}

const esc = (s: string): string => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
const money = (n: number, currency: string): string => `${currency} ${(Number(n) || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`

export interface PayslipTemplateInput {
  detail: PayrollRunDetailDTO
  run: PayrollRunDTO
  hotelName: string
  employeeName?: string
  currency?: string
  payslipNumber?: string
}

export function renderPayslipHtml(input: PayslipTemplateInput): string {
  const { detail, run, hotelName } = input
  const currency = input.currency || 'DOP'
  const employee = input.employeeName || detail.employeeId
  const earnings = parseLines(detail.earnings)
  const deductions = parseLines(detail.deductions)
  // Si no hay líneas detalladas, mostramos al menos el salario base y el total de deducciones.
  const earnRows = earnings.length ? earnings : [{ name: 'Salario base', amount: detail.baseSalary }]
  const dedRows = deductions.length ? deductions : (detail.totalDeductions > 0 ? [{ name: 'Deducciones', amount: detail.totalDeductions }] : [])

  const row = (l: LineItem) => `<tr><td>${esc(l.name)}</td><td class="r">${money(l.amount, currency)}</td></tr>`

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8">
<title>Recibo de nómina — ${esc(employee)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #1e293b; margin: 0; font-size: 13px; }
  .wrap { max-width: 720px; margin: 0 auto; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0891b2; padding-bottom: 12px; }
  .hotel { font-size: 20px; font-weight: 800; color: #0f172a; }
  .doc { text-align: right; }
  .doc .t { font-size: 15px; font-weight: 800; color: #0891b2; text-transform: uppercase; letter-spacing: .05em; }
  .doc .n { color: #64748b; font-size: 12px; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin: 18px 0; }
  .meta .k { color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
  .meta .v { font-weight: 700; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #64748b; border-bottom: 1px solid #e2e8f0; padding: 6px 4px; }
  td { padding: 6px 4px; border-bottom: 1px solid #f1f5f9; }
  td.r, th.r { text-align: right; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 10px; }
  .sub { display: flex; justify-content: space-between; font-weight: 700; padding: 6px 4px; border-top: 2px solid #e2e8f0; }
  .net { margin-top: 22px; background: #ecfeff; border: 1px solid #a5f3fc; border-radius: 10px; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; }
  .net .l { font-weight: 800; color: #0f172a; }
  .net .a { font-size: 22px; font-weight: 800; color: #0891b2; }
  .foot { margin-top: 30px; color: #94a3b8; font-size: 11px; text-align: center; }
</style></head>
<body><div class="wrap">
  <div class="head">
    <div><div class="hotel">${esc(hotelName)}</div><div style="color:#64748b">Recibo de sueldo</div></div>
    <div class="doc"><div class="t">Recibo de nómina</div><div class="n">${esc(input.payslipNumber || detail.id.slice(0, 8))}</div></div>
  </div>

  <div class="meta">
    <div><div class="k">Empleado</div><div class="v">${esc(employee)}</div></div>
    <div><div class="k">Período</div><div class="v">${esc(run.period || `${run.startDate} → ${run.endDate}`)}</div></div>
    <div><div class="k">Días trabajados</div><div class="v">${detail.daysWorked}</div></div>
    <div><div class="k">Horas extra</div><div class="v">${detail.overtimeHours}</div></div>
  </div>

  <div class="cols">
    <div>
      <table><thead><tr><th>Devengos</th><th class="r">Monto</th></tr></thead>
      <tbody>${earnRows.map(row).join('')}</tbody></table>
      <div class="sub"><span>Total devengado</span><span>${money(detail.grossPay, currency)}</span></div>
    </div>
    <div>
      <table><thead><tr><th>Deducciones</th><th class="r">Monto</th></tr></thead>
      <tbody>${dedRows.length ? dedRows.map(row).join('') : '<tr><td colspan="2" style="color:#94a3b8">Sin deducciones</td></tr>'}</tbody></table>
      <div class="sub"><span>Total deducciones</span><span>${money(detail.totalDeductions, currency)}</span></div>
    </div>
  </div>

  <div class="net"><span class="l">Neto a pagar</span><span class="a">${money(detail.netPay, currency)}</span></div>

  <div class="foot">Documento generado automáticamente por ${esc(hotelName)} · No requiere firma para su validez interna.</div>
</div></body></html>`
}
