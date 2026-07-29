// accounting/usecases/account-codes.ts — Códigos de cuenta del plan base que usan los conectores
// automáticos (CTB-4). Un solo lugar para no desincronizar los mapeos evento→asiento (design.md).
export const ACC = {
  CAJA: '1.1.01',
  BANCOS: '1.1.02',
  CLIENTES: '1.1.03',        // cuentas por cobrar (guest ledger)
  AP: '2.1.01',              // cuentas por pagar proveedores
  ITBIS_POR_PAGAR: '2.1.02',
  DEPOSITOS_HUESPEDES: '2.1.03',
  PROPINAS_POR_PAGAR: '2.1.05',   // propinas cobradas, adeudadas al personal (RES-6)
  ING_HABITACION: '4.1.01',
  ING_SERVICIOS: '4.2.01',
  ING_RESTAURANTE: '4.2.02',      // ventas del restaurante (POS) — RES-6
  GASTO_NOMINA: '5.2.01',
  GASTO_ADMIN: '5.3.01',
  // DT-15: diferencia de arqueo de caja. Reusa cuentas YA seedeadas (seed-chart-of-accounts.ts)
  // — no hace falta agregar cuentas nuevas al plan de 36. Sobrante = ingreso no operativo
  // (4.3.01 Otros Ingresos, ya existía sin uso); faltante = mismo bucket que cualquier otro
  // gasto administrativo sin categoría propia (GASTO_ADMIN, 5.3.01).
  OTROS_INGRESOS: '4.3.01',
} as const

/** Efectivo → Caja; todo lo demás (tarjeta/transfer/link) ya está bancarizado → Bancos. */
export function cashAccountForMethod(method?: string): string {
  return method === 'cash' ? ACC.CAJA : ACC.BANCOS
}

/** Ingreso por categoría de cargo: habitación, restaurante (POS), o servicios/extras. */
export function incomeAccountForCategory(category?: string): string {
  if (category === 'room') return ACC.ING_HABITACION
  if (category === 'restaurant') return ACC.ING_RESTAURANTE   // unifica folio (charge-to-room) y venta directa
  return ACC.ING_SERVICIOS
}

/** Cuenta de gasto según el origen: la nómina va a su propia cuenta. */
export function expenseAccountForSource(source?: string): string {
  return source === 'payroll' ? ACC.GASTO_NOMINA : ACC.GASTO_ADMIN
}
