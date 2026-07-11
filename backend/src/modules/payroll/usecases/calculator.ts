// payroll/usecases/calculator.ts — Engine de cálculo de nómina

import type { RepositoryAdapter, Logger } from 'arckode-framework'
import type {
  PayrollConceptDTO, PayrollConfigDTO,
  PayrollEmployeeInput, PayrollEmployeeResult,
  PayrollEarningItem, PayrollDeductionItem,
  PayrollCalculationResult,
} from '../types'

// ─── Safe Formula Evaluator ─────────────────────────────
// Reemplaza new Function() con un parser matemático que solo permite:
// números, operadores aritméticos (+−*/%), paréntesis y variables conocidas.
// Cualquier intento de inyección (function calls, property access, etc.) es rechazado.

const ALLOWED_VARS = ['base', 'overtimeAmount', 'overtimeHours', 'daysWorked', 'hoursWorked'] as const
const SAFE_FORMULA_RE = /^[0-9+\-*/().%\s]+$/

function safeEvalFormula(formula: string, vars: Record<string, number>): number {
  // 1. Reemplazar variables conocidas por sus valores numéricos
  let expr = formula
  for (const name of ALLOWED_VARS) {
    expr = expr.replaceAll(name, `(${vars[name] ?? 0})`)
  }

  // 2. Validar que solo quedan caracteres seguros (números, operadores, paréntesis)
  if (!SAFE_FORMULA_RE.test(expr)) {
    throw new Error(`Formula contains disallowed characters: ${formula}`)
  }

  // 3. Evaluar con parser recursivo (sin eval, sin new Function)
  const tokens = tokenize(expr)
  const ctx = { pos: 0 }
  const result = parseExpression(tokens, ctx)
  // Sobran tokens sin consumir → fórmula malformada. (Antes chequeaba `tokens.length > 0`, que es
  // SIEMPRE verdadero: toda fórmula válida lanzaba y devolvía 0. Ningún concepto usaba fórmulas, por
  // eso el bug quedó oculto tras el fix de RCE.)
  if (ctx.pos < tokens.length) throw new Error('Unexpected token at end of formula')
  return result
}

type TokenNum = { type: 'num'; value: number }
type TokenOp = { type: 'op'; value: string }
type TokenParen = { type: 'lparen' } | { type: 'rparen' }
type Token = TokenNum | TokenOp | TokenParen

function tokenize(expr: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < expr.length) {
    if (expr[i] === ' ') { i++; continue }
    if (expr[i] === '(') { tokens.push({ type: 'lparen' }); i++; continue }
    if (expr[i] === ')') { tokens.push({ type: 'rparen' }); i++; continue }
    if ('+-*/%'.includes(expr[i])) { tokens.push({ type: 'op', value: expr[i] }); i++; continue }
    if (/[\d.]/.test(expr[i])) {
      let num = ''
      while (i < expr.length && /[\d.]/.test(expr[i])) { num += expr[i]; i++ }
      tokens.push({ type: 'num', value: parseFloat(num) })
      continue
    }
    throw new Error(`Unexpected character in formula: ${expr[i]}`)
  }
  return tokens
}

// Expression = Term (('+' | '-') Term)*
function parseExpression(tokens: Token[], ctx: { pos: number }): number {
  let result = parseTerm(tokens, ctx)
  while (ctx.pos < tokens.length && tokens[ctx.pos].type === 'op' && ('+-'.includes((tokens[ctx.pos] as TokenOp).value))) {
    const op = (tokens[ctx.pos] as TokenOp).value; ctx.pos++
    const right = parseTerm(tokens, ctx)
    result = op === '+' ? result + right : result - right
  }
  return result
}

// Term = Factor (('*' | '/' | '%') Factor)*
function parseTerm(tokens: Token[], ctx: { pos: number }): number {
  let result = parseFactor(tokens, ctx)
  while (ctx.pos < tokens.length && tokens[ctx.pos].type === 'op' && ('*/%'.includes((tokens[ctx.pos] as TokenOp).value))) {
    const op = (tokens[ctx.pos] as TokenOp).value; ctx.pos++
    const right = parseFactor(tokens, ctx)
    if (op === '*') result *= right
    else if (op === '/') result /= right
    else result %= right
  }
  return result
}

// Factor = ['+' | '-'] (Number | '(' Expression ')')
function parseFactor(tokens: Token[], ctx: { pos: number }): number {
  let negate = false
  if (ctx.pos < tokens.length && tokens[ctx.pos].type === 'op' && (tokens[ctx.pos] as TokenOp).value === '-') {
    negate = true; ctx.pos++
  }
  if (ctx.pos < tokens.length && tokens[ctx.pos].type === 'op' && (tokens[ctx.pos] as TokenOp).value === '+') {
    ctx.pos++
  }
  if (ctx.pos >= tokens.length) throw new Error('Unexpected end of formula')
  const tok = tokens[ctx.pos]
  if (tok.type === 'num') { ctx.pos++; return negate ? -tok.value : tok.value }
  if (tok.type === 'lparen') {
    ctx.pos++
    const result = parseExpression(tokens, ctx)
    if (ctx.pos >= tokens.length || tokens[ctx.pos].type !== 'rparen') throw new Error('Missing closing parenthesis')
    ctx.pos++
    return negate ? -result : result
  }
  throw new Error(`Unexpected token in formula: ${JSON.stringify(tok)}`)
}

interface TaxBracket { from: number; to?: number; rate: number }

/**
 * Porción del sueldo MENSUAL que se paga en una liquidación según la frecuencia. El sueldo del legajo
 * se guarda mensual; una corrida semanal paga ~1/4.33, una quincenal la mitad, una mensual el total.
 * (semanal = mensual×12/52 ≈ /4.333 — 52 semanas al año, no 4 por mes.)
 */
export function periodBaseFor(monthlySalary: number, frequency?: string): number {
  switch (frequency) {
    case 'weekly': return (monthlySalary * 12) / 52
    case 'biweekly': return monthlySalary / 2
    case 'monthly':
    default: return monthlySalary
  }
}

export class PayrollCalculatorUseCase {
  constructor(
    private readonly conceptRepo: RepositoryAdapter<PayrollConceptDTO>,
    private readonly configRepo: RepositoryAdapter<PayrollConfigDTO>,
    private readonly logger: Logger,
  ) {}

  async calculate(
    hotelId: string,
    period: string,
    config: PayrollConfigDTO,
    employees: PayrollEmployeeInput[],
  ): Promise<PayrollCalculationResult> {
    const concepts = await this.conceptRepo.findMany({ hotelId, active: 1 })

    const earnings = concepts.filter(c => c.type === 'earning' || c.type === 'contribution')
    const deductions = concepts.filter(c => c.type === 'deduction' || c.type === 'tax')

    let taxBrackets: TaxBracket[] = []
    if (config.incomeTaxRates) {
      try {
        taxBrackets = JSON.parse(config.incomeTaxRates)
      } catch {
        this.logger.warn('Invalid incomeTaxRates JSON in config, skipping tax calculation', { hotelId })
      }
    }

    const results: PayrollEmployeeResult[] = []
    let totalGross = 0
    let totalDeductions = 0
    let totalNet = 0

    const frequency = config.paymentFrequency || 'monthly'

    for (const emp of employees) {
      // Sueldo del período según la frecuencia (mensual FIJO: no se prorratea por días fichados; los
      // fines de semana no restan). Las faltas reales SÍ se descuentan a día de sueldo (mensual/30).
      const periodBase = periodBaseFor(emp.baseSalary, frequency)
      const dailyRate = emp.baseSalary / 30
      const effectiveBase = Math.max(0, periodBase - dailyRate * emp.absences)

      // Horas extra: el monto ya multiplicado. El concepto OT (formula: overtimeAmount) lo cobra solo.
      const overtimeRate = (emp.baseSalary / 30 / 8) * config.overtimeMultiplier
      const overtimeAmount = emp.overtimeHours * overtimeRate

      // Calculate earnings from concepts
      const empEarnings: PayrollEarningItem[] = []
      let totalEarnings = 0

      for (const concept of earnings) {
        const amt = this.calculateConceptAmount(concept, {
          base: effectiveBase,
          overtimeAmount,
          overtimeHours: emp.overtimeHours,
          daysWorked: emp.daysWorked,
          hoursWorked: emp.hoursWorked,
        })
        if (amt > 0) {
          empEarnings.push({ conceptId: concept.id, name: concept.name, code: concept.code, amount: Math.round(amt * 100) / 100 })
          totalEarnings += amt
        }
      }

      const grossPay = Math.round(totalEarnings * 100) / 100

      // Calculate deductions
      const empDeductions: PayrollDeductionItem[] = []
      let totalDed = 0

      for (const concept of deductions) {
        if (concept.code === 'TAX' || concept.code === 'ISR') {
          const tax = this.calculateIncomeTax(grossPay, taxBrackets)
          if (tax > 0) {
            empDeductions.push({ conceptId: concept.id, name: concept.name, code: concept.code, amount: Math.round(tax * 100) / 100 })
            totalDed += tax
          }
        } else {
          const amt = this.calculateConceptAmount(concept, {
            base: grossPay,
            overtimeAmount,
            overtimeHours: emp.overtimeHours,
            daysWorked: emp.daysWorked,
            hoursWorked: emp.hoursWorked,
          })
          if (amt > 0) {
            empDeductions.push({ conceptId: concept.id, name: concept.name, code: concept.code, amount: Math.round(amt * 100) / 100 })
            totalDed += amt
          }
        }
      }

      const totalDeductionsRounded = Math.round(totalDed * 100) / 100
      const netPay = Math.round((grossPay - totalDeductionsRounded) * 100) / 100

      results.push({
        employeeId: emp.employeeId,
        baseSalary: emp.baseSalary,
        daysWorked: emp.daysWorked,
        hoursWorked: emp.hoursWorked,
        overtimeHours: emp.overtimeHours,
        absences: emp.absences,
        earnings: empEarnings,
        deductions: empDeductions,
        grossPay,
        totalDeductions: totalDeductionsRounded,
        netPay,
      })

      totalGross += grossPay
      totalDeductions += totalDeductionsRounded
      totalNet += netPay
    }

    return {
      period,
      employees: results,
      totalGross: Math.round(totalGross * 100) / 100,
      totalDeductions: Math.round(totalDeductions * 100) / 100,
      totalNet: Math.round(totalNet * 100) / 100,
      employeeCount: results.length,
    }
  }

  private calculateConceptAmount(
    concept: PayrollConceptDTO,
    vars: { base: number; overtimeAmount: number; overtimeHours: number; daysWorked: number; hoursWorked: number },
  ): number {
    switch (concept.calculationMethod) {
      case 'fixed':
        return concept.value ?? 0
      case 'percentage':
        return vars.base * ((concept.value ?? 0) / 100)
      case 'hours_based':
        return (concept.value ?? 0) * vars.hoursWorked
      case 'formula':
        if (!concept.formula) return 0
        try {
          return safeEvalFormula(concept.formula, vars)
        } catch (err) {
          this.logger.warn('Formula evaluation failed, defaulting to 0', { formula: concept.formula, error: String(err) })
          return 0
        }
      default:
        return 0
    }
  }

  private calculateIncomeTax(annualizedGross: number, brackets: TaxBracket[]): number {
    if (!brackets.length) return 0
    // Annualize
    const annual = annualizedGross * 12
    let remaining = annual
    let tax = 0

    for (const bracket of brackets) {
      if (remaining <= 0) break
      const slabTop = bracket.to ?? Infinity
      const slabAmount = bracket.from > 0 ? Math.min(slabTop - bracket.from, remaining) : Math.min(slabTop, remaining)
      if (slabAmount <= 0) continue
      tax += slabAmount * (bracket.rate / 100)
      remaining -= slabAmount
    }

    return Math.round((tax / 12) * 100) / 100 // Monthly tax
  }
}
