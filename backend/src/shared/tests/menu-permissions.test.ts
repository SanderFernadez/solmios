// shared/tests/menu-permissions.test.ts — El menú no puede prometer páginas que la API niega.
//
// Regresión: el panel le mostraba a `receptionist` seis páginas (Folios, Links de Pago, Empleados,
// Asistencia, Plantillas WhatsApp, Historial de Envíos) cuya API le contestaba 403.
//
// Y peor: fichar entrada (`POST /api/attendance/clock-in`) pedía `users:create`, que solo tiene
// hotel_admin. Ninguna camarera, recepcionista ni mantenimiento podía fichar — que es exactamente
// lo que hace la app del personal.

import { describe, it, expect } from 'bun:test'
import { DEFAULT_ROLE_PERMISSIONS, hasPermission, MODULES } from '../permissions'

/** Lo que el menú del panel (AdminLayout.vue) le muestra a la recepcionista, y qué exige cada API. */
const MENU_RECEPCION: Array<[pagina: string, modulo: string, accion: string]> = [
  ['Reservas', 'reservations', 'view'],
  ['Check-in/out', 'reservations', 'checkin'],
  ['Habitaciones', 'rooms', 'view'],
  ['Folios In-House', 'billing', 'view'],
  ['Links de Pago', 'billing', 'view'],
  ['Opiniones', 'reports', 'view'],
  ['Recepcionista IA', 'ai', 'view'],
  ['Empleados', 'users', 'view'],
  ['Asistencia', 'attendance', 'view'],
  ['Historial Envíos', 'settings', 'view'],
  ['Plantillas WhatsApp', 'settings', 'view'],
  ['Soporte', 'reports', 'view'],
]

/** Acciones que la recepcionista dispara DENTRO de esas páginas. */
const ACCIONES_RECEPCION: Array<[que: string, modulo: string, accion: string]> = [
  ['postear un cargo al folio', 'billing', 'create'],
  ['cobrar un pago del folio', 'billing', 'create'],
  ['crear un link de pago', 'billing', 'create'],
  ['abrir un ticket de soporte', 'reports', 'create'],
  ['responder una opinión', 'reports', 'edit'],
  ['responder al recepcionista IA', 'ai', 'edit'],
  ['fichar entrada', 'attendance', 'create'],
]

describe('receptionist — el menú y la API coinciden', () => {
  const perms = DEFAULT_ROLE_PERMISSIONS.receptionist

  for (const [pagina, modulo, accion] of MENU_RECEPCION) {
    it(`puede abrir "${pagina}"`, () => {
      expect(hasPermission(perms, modulo, accion)).toBe(true)
    })
  }

  for (const [que, modulo, accion] of ACCIONES_RECEPCION) {
    it(`puede ${que}`, () => {
      expect(hasPermission(perms, modulo, accion)).toBe(true)
    })
  }

  // Cerrar un folio, emitir la factura o borrarla es del dueño del hotel.
  it('NO puede cerrar folios ni borrar facturas', () => {
    expect(hasPermission(perms, 'billing', 'edit')).toBe(false)
    expect(hasPermission(perms, 'billing', 'delete')).toBe(false)
  })

  it('NO puede crear ni borrar usuarios', () => {
    expect(hasPermission(perms, 'users', 'create')).toBe(false)
    expect(hasPermission(perms, 'users', 'delete')).toBe(false)
  })

  it('NO puede tocar la configuración del hotel', () => {
    expect(hasPermission(perms, 'settings', 'edit')).toBe(false)
  })
})

describe('todo el personal puede fichar', () => {
  // `attendance` existe justamente para esto: fichar no es administrar usuarios.
  for (const role of ['hotel_admin', 'receptionist', 'housekeeper', 'maintenance', 'supervisor']) {
    it(`${role} ficha entrada y salida`, () => {
      expect(hasPermission(DEFAULT_ROLE_PERMISSIONS[role], 'attendance', 'create')).toBe(true)
    })
  }

  it('solo supervisión corrige un fichaje ajeno', () => {
    expect(hasPermission(DEFAULT_ROLE_PERMISSIONS.hotel_admin, 'attendance', 'edit')).toBe(true)
    expect(hasPermission(DEFAULT_ROLE_PERMISSIONS.supervisor, 'attendance', 'edit')).toBe(true)
    expect(hasPermission(DEFAULT_ROLE_PERMISSIONS.housekeeper, 'attendance', 'edit')).toBe(false)
    expect(hasPermission(DEFAULT_ROLE_PERMISSIONS.receptionist, 'attendance', 'edit')).toBe(false)
  })

  it('nadie ficha con `users:create`: eso es crear un usuario', () => {
    for (const role of ['receptionist', 'housekeeper', 'maintenance', 'supervisor']) {
      expect(hasPermission(DEFAULT_ROLE_PERMISSIONS[role], 'users', 'create')).toBe(false)
    }
  })
})

describe('coherencia del catálogo', () => {
  it('todo permiso de un rol usa un módulo declarado en MODULES', () => {
    const modulos = new Set(Object.keys(MODULES))
    for (const [role, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      for (const p of perms) {
        const [modulo] = p.split(':')
        expect(modulos.has(modulo), `${role} usa el módulo desconocido "${modulo}"`).toBe(true)
      }
    }
  })
})
