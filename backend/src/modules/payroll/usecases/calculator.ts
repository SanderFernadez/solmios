// payroll/usecases/calculator.ts — Engine de cálculo de nómina

import type { RepositoryAdapter, Logger } from 'arckode-framework'
import type {
  PayrollConceptDTO, PayrollConfigDTO,
  PayrollEmployeeInput, PayrollEmployeeResult,
  PayrollEarningItem, PayrollDeductionItem,
  PayrollCalculationResult,
} from '../types'

interface TaxBracket { from: number; to?: number; rate: number }

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

    const taxBrackets: TaxBracket[] = config.incomeTaxRates
      ? JSON.parse(config.incomeTaxRates)
      : []

    const results: PayrollEmployeeResult[] = []
    let totalGross = 0
    let totalDeductions = 0
    let totalNet = 0

    for (const emp of employees) {
      const dailyRate = emp.daysWorked > 0
        ? emp.baseSalary / this.totalDaysInPeriod(period)
        : 0
      const proportionalBase = dailyRate * emp.daysWorked

      // Calculate overtime
      const overtimeRate = (emp.baseSalary / 30 / 8) * config.overtimeMultiplier
      const overtimeAmount = emp.overtimeHours * overtimeRate

      // Calculate earnings from concepts
      const empEarnings: PayrollEarningItem[] = []
      let totalEarnings = 0

      for (const concept of earnings) {
        const amt = this.calculateConceptAmount(concept, {
          base: proportionalBase,
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
          return new Function('vars', `with(vars) { return ${concept.formula} }`)(vars)
        } catch { return 0 }
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

  private totalDaysInPeriod(period: string): number {
    const parts = period.split('-')
    if (parts.length === 3) {
      const year = parseInt(parts[0])
      const month = parseInt(parts[1])
      return new Date(year, month, 0).getDate()
    }
    return 30
  }
}
