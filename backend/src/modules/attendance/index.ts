// attendance/index.ts — PUERTA PÚBLICA
import { createModule, OrmRepository } from 'arckode-framework'
import { registerAttendanceModels } from './model'
import { AttendanceService } from './service'
import { AttendanceController } from './controller'
import type { AttendanceRecordDTO, AttendanceScheduleDTO, AttendanceConfigDTO } from './types'

export { AttendanceService }
export type { AttendanceRecordDTO, AttendanceScheduleDTO, AttendanceConfigDTO, AttendanceReport, AttendanceQuery } from './types'
export type { AttendanceSockets } from './sockets'

export function AttendanceModule() {
  return createModule({
    name: 'attendance', version: '1.0.0',
    description: 'Asistencia — fichaje digital, horarios, reportes',

    contract: {
      name: 'attendance', version: '1.0.0',
      description: 'Ponche digital + horarios',
      actions: ['clockIn','clockOut','startBreak','endBreak','manualRecord','getToday','listRecords','getReport','createSchedule','listSchedules','deleteSchedule','getConfig','updateConfig'],
      events: ['onClockIn','onClockOut'],
      tables: ['attendance_records','attendance_schedules','attendance_config'],
      dependencies: [],
      rules: ['No importar de otros módulos'],
    },

    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('attendance: auth dependency required')
      registerAttendanceModels(orm)

      const recordRepo = new OrmRepository<AttendanceRecordDTO>(orm, 'AttendanceRecord')
      const scheduleRepo = new OrmRepository<AttendanceScheduleDTO>(orm, 'AttendanceSchedule')
      const configRepo = new OrmRepository<AttendanceConfigDTO>(orm, 'AttendanceConfig')

      const log = logger.child('attendance')
      const service = new AttendanceService(recordRepo, scheduleRepo, configRepo, log, cache)
      const controller = new AttendanceController(service, log)

      // Clock — cualquier empleado autenticado puede fichar
      router.post('/api/attendance/clock-in', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.clockIn(req))
      router.post('/api/attendance/clock-out', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.clockOut(req))
      router.post('/api/attendance/break/start', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.startBreak(req))
      router.post('/api/attendance/break/end', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.endBreak(req))
      router.post('/api/attendance/manual', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.manualRecord(req))
      router.get('/api/attendance/today/:employeeId', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.getToday(req))
      router.get('/api/attendance/records', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.listRecords(req))
      router.get('/api/attendance/report', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.getReport(req))

      // Schedules
      router.post('/api/attendance/schedules', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.createSchedule(req))
      router.get('/api/attendance/schedules', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.listSchedules(req))
      router.get('/api/attendance/schedules/:id', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.getSchedule(req))
      router.delete('/api/attendance/schedules/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.deleteSchedule(req))

      // Config
      router.get('/api/attendance/config', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.getConfig(req))
      router.put('/api/attendance/config', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.updateConfig(req))

      // Biometric device webhook (ZKTeco / fingerprint — public, key-protected)
      router.post('/api/attendance/biometric', (req) => controller.biometricRecord(req))

      log.info('Módulo attendance listo — 3 tablas, 15 endpoints')
      return service
    },
  })
}
