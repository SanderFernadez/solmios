// capacitacion/tests/service.test.ts — Cursos + inscripciones (multi-tenant, ciclo enroll→complete).

import { describe, it, expect } from 'bun:test'
import type { CacheAdapter } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { CapacitacionService } from '../service'

const log = silentLogger()
const cache: CacheAdapter = { get: async () => null, set: async () => {}, delete: async () => {}, flush: async () => {} }

function repo(rows: any[] = []) {
  const data = [...rows]
  return {
    _rows: data,
    findMany: async (f: any) => data.filter((r) => Object.entries(f).every(([k, v]) => r[k] === v)),
    findOne: async (f: any) => data.find((r) => Object.entries(f).every(([k, v]) => r[k] === v)) ?? null,
    create: async (d: any) => { const row = { id: 'new-' + data.length, ...d }; data.push(row); return row },
    update: async (id: string, d: any) => { const r = data.find((x) => x.id === id); Object.assign(r, d); return r },
    delete: async (id: string) => { const i = data.findIndex((x) => x.id === id); if (i >= 0) data.splice(i, 1); return true },
  } as any
}

function make(opts: { courses?: any[]; enrollments?: any[]; employeeOk?: boolean } = {}) {
  const courseRepo = repo(opts.courses)
  const enrollRepo = repo(opts.enrollments)
  const profileRepo = { findOne: async () => (opts.employeeOk === false ? null : { id: 'e1', hotelId: 'h1' }) } as any
  return { svc: new CapacitacionService(courseRepo, enrollRepo, log, cache, profileRepo), courseRepo, enrollRepo }
}

const COURSE = { id: 'c1', hotelId: 'h1', name: 'Manejo de alimentos', type: 'certification', validityMonths: 12 }

describe('CapacitacionService', () => {
  it('crea un curso activo', async () => {
    const { svc } = make()
    const c = await svc.createCourse({ hotelId: 'h1', name: 'Inducción' })
    expect(c.active).toBe(1)
  })

  it('no devuelve un curso de otro hotel (sin IDOR)', async () => {
    const { svc } = make({ courses: [{ ...COURSE, hotelId: 'h2' }] })
    await expect(svc.getCourse('c1', 'h1')).rejects.toThrow(/no encontrado/i)
  })

  it('inscribe a un empleado', async () => {
    const { svc } = make({ courses: [COURSE] })
    const e = await svc.enroll({ hotelId: 'h1', courseId: 'c1', employeeId: 'e1' })
    expect(e.status).toBe('enrolled')
    expect(e.enrolledAt).toBeTruthy()
  })

  it('no duplica una inscripción activa', async () => {
    const { svc } = make({ courses: [COURSE], enrollments: [{ id: 'en1', hotelId: 'h1', courseId: 'c1', employeeId: 'e1', status: 'enrolled' }] })
    await expect(svc.enroll({ hotelId: 'h1', courseId: 'c1', employeeId: 'e1' })).rejects.toThrow(/ya está inscripto/i)
  })

  it('rechaza inscribir a un empleado de otro hotel', async () => {
    const { svc } = make({ courses: [COURSE], employeeOk: false })
    await expect(svc.enroll({ hotelId: 'h1', courseId: 'c1', employeeId: 'e99' })).rejects.toThrow(/no pertenece/i)
  })

  it('completar una certificación con vigencia calcula expiresAt', async () => {
    const { svc } = make({ courses: [COURSE], enrollments: [{ id: 'en1', hotelId: 'h1', courseId: 'c1', employeeId: 'e1', status: 'enrolled' }] })
    const e = await svc.complete('en1', 'h1', 90)
    expect(e.status).toBe('completed')
    expect(e.completedAt).toBeTruthy()
    expect(e.expiresAt).toBeTruthy()   // validityMonths 12 → vence
    expect(e.score).toBe(90)
  })

  it('completar un curso sin vigencia no setea expiresAt', async () => {
    const { svc } = make({ courses: [{ id: 'c2', hotelId: 'h1', name: 'Charla', validityMonths: 0 }], enrollments: [{ id: 'en2', hotelId: 'h1', courseId: 'c2', employeeId: 'e1', status: 'enrolled' }] })
    const e = await svc.complete('en2', 'h1')
    expect(e.expiresAt).toBeNull()
  })

  it('borrar un curso borra sus inscripciones', async () => {
    const { svc, enrollRepo } = make({ courses: [COURSE], enrollments: [{ id: 'en1', hotelId: 'h1', courseId: 'c1', employeeId: 'e1', status: 'enrolled' }] })
    await svc.deleteCourse('c1', 'h1')
    expect(enrollRepo._rows).toHaveLength(0)
  })

  // ─── Autoconfirmación por token (el empleado confirma que lo tomó) ───
  it('confirmByToken marca la inscripción como completada', async () => {
    const { svc, enrollRepo } = make({ courses: [COURSE], enrollments: [{ id: 'en1', hotelId: 'h1', courseId: 'c1', employeeId: 'e1', status: 'enrolled', confirmToken: 'tok-123' }] })
    const res = await svc.confirmByToken('tok-123')
    expect(res?.alreadyDone).toBe(false)
    expect(enrollRepo._rows[0].status).toBe('completed')
    expect(enrollRepo._rows[0].expiresAt).toBeTruthy()   // COURSE vence en 12 meses
  })

  it('confirmByToken con token inválido devuelve null', async () => {
    const { svc } = make({ enrollments: [] })
    expect(await svc.confirmByToken('no-existe')).toBeNull()
  })

  it('confirmByToken sobre algo ya completado no rompe (alreadyDone=true)', async () => {
    const { svc } = make({ courses: [COURSE], enrollments: [{ id: 'en1', hotelId: 'h1', courseId: 'c1', employeeId: 'e1', status: 'completed', confirmToken: 'tok-9' }] })
    expect((await svc.confirmByToken('tok-9'))?.alreadyDone).toBe(true)
  })
})
