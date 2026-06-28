// migrations/1782253961079_create_payroll.ts
import type { MigrationRunner } from 'arckode-framework/cli/commands/db-migrate'

export async function up(db: MigrationRunner): Promise<void> {
  await db.run(`CREATE TABLE IF NOT EXISTS payroll_config (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, currency TEXT DEFAULT 'USD',
    paymentFrequency TEXT NOT NULL DEFAULT 'monthly', paymentDay INTEGER NOT NULL DEFAULT 30,
    overtimeMultiplier REAL DEFAULT 1.5, nightShiftMultiplier REAL DEFAULT 1.25,
    holidayMultiplier REAL DEFAULT 2.0, socialSecurityRate REAL, healthInsuranceRate REAL,
    incomeTaxRates TEXT, minimumWage REAL, maxOvertimeHoursWeekly INTEGER DEFAULT 12,
    provisionType TEXT DEFAULT 'monthly', aguinaldoEnabled INTEGER DEFAULT 1, aguinaldoMonths INTEGER DEFAULT 2,
    createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now'))
  )`)
  await db.run(`CREATE TABLE IF NOT EXISTS payroll_concepts (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, code TEXT NOT NULL, name TEXT NOT NULL,
    type TEXT NOT NULL, calculationMethod TEXT NOT NULL, value REAL, formula TEXT,
    appliesTo TEXT, priority INTEGER DEFAULT 0, active INTEGER DEFAULT 1, system INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now'))
  )`)
  await db.run(`CREATE TABLE IF NOT EXISTS payroll_runs (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, period TEXT NOT NULL,
    startDate TEXT NOT NULL, endDate TEXT NOT NULL, paymentDate TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft', totalGross REAL DEFAULT 0, totalDeductions REAL DEFAULT 0,
    totalNet REAL DEFAULT 0, employeeCount INTEGER DEFAULT 0,
    approvedBy TEXT, approvedAt TEXT, paidAt TEXT,
    createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now'))
  )`)
  await db.run(`CREATE TABLE IF NOT EXISTS payroll_run_details (
    id TEXT PRIMARY KEY, runId TEXT NOT NULL, employeeId TEXT NOT NULL,
    baseSalary REAL NOT NULL, daysWorked REAL NOT NULL DEFAULT 0, hoursWorked REAL NOT NULL DEFAULT 0,
    overtimeHours REAL DEFAULT 0, absences REAL DEFAULT 0, lateArrivals REAL DEFAULT 0,
    earnings TEXT, deductions TEXT, grossPay REAL NOT NULL DEFAULT 0,
    totalDeductions REAL NOT NULL DEFAULT 0, netPay REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending', payslipGenerated INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now'))
  )`)
  await db.run(`CREATE TABLE IF NOT EXISTS payroll_payslips (
    id TEXT PRIMARY KEY, runDetailId TEXT NOT NULL, employeeId TEXT NOT NULL,
    hotelId TEXT NOT NULL, period TEXT NOT NULL, payslipNumber TEXT NOT NULL,
    pdfPath TEXT, sentAt TEXT, sentVia TEXT, viewedAt TEXT,
    createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now'))
  )`)
  await db.run(`CREATE TABLE IF NOT EXISTS payroll_payment_history (
    id TEXT PRIMARY KEY, runId TEXT NOT NULL, employeeId TEXT NOT NULL,
    amount REAL NOT NULL, method TEXT NOT NULL, reference TEXT, paidAt TEXT NOT NULL,
    notes TEXT, createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now'))
  )`)
}

export async function down(db: MigrationRunner): Promise<void> {
  await db.run(`DROP TABLE IF EXISTS payroll_payment_history`)
  await db.run(`DROP TABLE IF EXISTS payroll_payslips`)
  await db.run(`DROP TABLE IF EXISTS payroll_run_details`)
  await db.run(`DROP TABLE IF EXISTS payroll_runs`)
  await db.run(`DROP TABLE IF EXISTS payroll_concepts`)
  await db.run(`DROP TABLE IF EXISTS payroll_config`)
}
