// migrations/1782251980727_create_empleados.ts
import type { MigrationRunner } from 'arckode-framework/cli/commands/db-migrate'

export async function up(db: MigrationRunner): Promise<void> {
  await db.run(`CREATE TABLE IF NOT EXISTS departments (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, name TEXT NOT NULL, description TEXT,
    managerId TEXT, parentId TEXT, active INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now'))
  )`)
  await db.run(`CREATE TABLE IF NOT EXISTS employee_profiles (
    id TEXT PRIMARY KEY, userId TEXT NOT NULL, hotelId TEXT NOT NULL,
    departmentId TEXT, position TEXT, managerId TEXT, hireDate TEXT,
    salary REAL, contractType TEXT, documentNumber TEXT, documentType TEXT,
    documentExpiry TEXT, address TEXT, city TEXT, country TEXT,
    emergencyContactName TEXT, emergencyContactPhone TEXT, emergencyContactRelation TEXT,
    bankName TEXT, bankAccount TEXT, vacationDaysTotal INTEGER DEFAULT 15,
    vacationDaysUsed INTEGER DEFAULT 0, notes TEXT, active INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now'))
  )`)
  await db.run(`CREATE TABLE IF NOT EXISTS employee_contracts (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, employeeId TEXT NOT NULL,
    type TEXT NOT NULL, startDate TEXT NOT NULL, endDate TEXT,
    salary REAL NOT NULL, currency TEXT DEFAULT 'USD', position TEXT,
    departmentId TEXT, status TEXT DEFAULT 'active', signedAt TEXT, notes TEXT,
    createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now'))
  )`)
  await db.run(`CREATE TABLE IF NOT EXISTS employee_documents (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, employeeId TEXT NOT NULL,
    type TEXT NOT NULL, name TEXT NOT NULL, fileUrl TEXT,
    expiryDate TEXT, issuedBy TEXT, notes TEXT, alertSent INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now'))
  )`)
  await db.run(`CREATE TABLE IF NOT EXISTS leave_requests (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, employeeId TEXT NOT NULL,
    type TEXT NOT NULL, startDate TEXT NOT NULL, endDate TEXT NOT NULL,
    days REAL NOT NULL, reason TEXT, status TEXT DEFAULT 'pending',
    approvedBy TEXT, approvedAt TEXT, notes TEXT,
    createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now'))
  )`)
  await db.run(`CREATE TABLE IF NOT EXISTS performance_reviews (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, employeeId TEXT NOT NULL,
    reviewerId TEXT NOT NULL, period TEXT, reviewDate TEXT NOT NULL,
    score REAL, strengths TEXT, improvements TEXT, goals TEXT, notes TEXT,
    status TEXT DEFAULT 'draft',
    createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now'))
  )`)
}

export async function down(db: MigrationRunner): Promise<void> {
  await db.run(`DROP TABLE IF EXISTS performance_reviews`)
  await db.run(`DROP TABLE IF EXISTS leave_requests`)
  await db.run(`DROP TABLE IF EXISTS employee_documents`)
  await db.run(`DROP TABLE IF EXISTS employee_contracts`)
  await db.run(`DROP TABLE IF EXISTS employee_profiles`)
  await db.run(`DROP TABLE IF EXISTS departments`)
}
