// seeds/attendance.ts — Datos de prueba
import type { SeedOrm } from 'arckode-framework/cli/commands/db-seed'

export async function seedAttendance(orm: SeedOrm): Promise<void> {
  const items = [
    {
    nombre: 'Attendance de ejemplo'
    activo: true
    },
    {
    nombre: 'Attendance de ejemplo 2'
    activo: true
    },
  ]

  await Promise.all(items.map(item => orm.create('Attendance', item)))

  console.log('  ✓ Attendance seeded: ' + items.length + ' items')
}
