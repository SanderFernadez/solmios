import { BalanceStrategy } from './balance'
import { FacturacionStrategy } from './facturacion'
import { OcupacionStrategy } from './ocupacion'
import { PernoctacionesStrategy } from './pernoctaciones'
import { RendimientoStrategy } from './rendimiento'
import { ProcedenciaStrategy } from './procedencia'
import { ReservasStrategy } from './reservas'

export const reportStrategies = [
  new BalanceStrategy(),
  new FacturacionStrategy(),
  new OcupacionStrategy(),
  new PernoctacionesStrategy(),
  new RendimientoStrategy(),
  new ProcedenciaStrategy(),
  new ReservasStrategy(),
]
