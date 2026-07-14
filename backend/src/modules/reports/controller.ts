import type { HttpRequest, Logger } from 'arckode-framework'
import type { ReportsService } from './service'
import { csvValue } from './helpers'

export class ReportsController {
  constructor(
    private readonly service: ReportsService,
    private readonly logger: Logger,
  ) {}

  async getReports(req: HttpRequest) {
    return { status: 200, body: await this.service.getReports(req) }
  }

  async getAdvancedReport(req: HttpRequest) {
    try {
      return { status: 200, body: await this.service.getAdvancedReport(req) }
    } catch (e: any) {
      return { status: 400, body: { error: e.message } }
    }
  }

  async exportReport(req: HttpRequest) {
    const data = await this.service.getAdvancedReport(req)
    const rows: string[] = []
    if (Array.isArray(data.daily)) {
      if (data.daily.length === 0) rows.push('Sin datos en el rango seleccionado')
      else { const keys = Object.keys(data.daily[0]); rows.push(keys.join(',')); for (const d of data.daily) rows.push(keys.map(k => csvValue(d[k])).join(',')) }
    } else {
      rows.push(`Reporte ${data.type || ''} — sin datos tabulares`)
      // Las CLAVES también pueden ser datos de usuario (categoría de gasto, país del huésped):
      // pasan por csvValue igual que los valores, o serían un vector de fórmula.
      for (const [k, v] of Object.entries(data)) {
        if (typeof v === 'object' && v !== null && !Array.isArray(v)) for (const [k2, v2] of Object.entries(v as any)) rows.push(`${csvValue(`${k}.${k2}`)},${csvValue(v2)}`)
        else rows.push(`${csvValue(k)},${csvValue(v)}`)
      }
    }
    // Body como Buffer, NO string: el framework envuelve todo body no-Buffer en el envelope JSON
    // {success,data} (server.ts), y el .csv salía como un blob JSON con `\n` literales, inservible
    // en Excel. Un Buffer se escribe crudo, respetando el Content-Type text/csv.
    return { status: 200, headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="reporte-${data.type || 'export'}-${new Date().toISOString().slice(0, 10)}.csv"` }, body: Buffer.from(rows.join('\n'), 'utf-8') }
  }

  async getNightAudit(req: HttpRequest) {
    return { status: 200, body: await this.service.getNightAudit(req) }
  }

  async markNoShows(req: HttpRequest) {
    const marked = await this.service.markNoShows(req)
    return { status: 200, body: { success: true, marked } }
  }
}
