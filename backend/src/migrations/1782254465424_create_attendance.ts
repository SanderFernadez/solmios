// migrations/1782254465424_create_attendance.ts
import type { MigrationRunner } from 'arckode-framework/cli/commands/db-migrate'

export async function up(db: MigrationRunner): Promise<void> {
  await db.run(`CREATE TABLE IF NOT EXISTS attendance_records (
    id TEXT PRIMARY KEY, employeeId TEXT NOT NULL, hotelId TEXT NOT NULL,
    date TEXT NOT NULL, clockIn TEXT, clockOut TEXT, breakStart TEXT, breakEnd TEXT,
    totalHours REAL, overtimeHours REAL DEFAULT 0, status TEXT NOT NULL DEFAULT 'present',
    method TEXT NOT NULL DEFAULT 'pin', location TEXT, notes TEXT, approvedBy TEXT,
    createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now'))
  )`)
  await db.run(`CREATE TABLE IF NOT EXISTS attendance_schedules (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, name TEXT NOT NULL,
    startTime TEXT NOT NULL, endTime TEXT NOT NULL, breakMinutes INTEGER DEFAULT 60,
    graceMinutes INTEGER DEFAULT 15, overtimeThresholdMinutes INTEGER DEFAULT 0, active INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now'))
  )`)
  await db.run(`CREATE TABLE IF NOT EXISTS attendance_config (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, defaultScheduleId TEXT,
    requirePhotoOnClockIn INTEGER DEFAULT 0, requireLocationOnClockIn INTEGER DEFAULT 0,
    geoFenceRadiusMeters REAL DEFAULT 100, allowMobileClockIn INTEGER DEFAULT 1,
    autoClockOut INTEGER DEFAULT 1, autoClockOutTime TEXT DEFAULT '23:59',
    overtimeEnabled INTEGER DEFAULT 1, overtimeMultiplier REAL DEFAULT 1.5,
    weeklyHoursLimit REAL DEFAULT 48,
    createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now'))
  )`)
}

export async function down(db: MigrationRunner): Promise<void> {
  await db.run(`DROP TABLE IF EXISTS attendance_config`)
  await db.run(`DROP TABLE IF EXISTS attendance_schedules`)
  await db.run(`DROP TABLE IF EXISTS attendance_records`)
}
