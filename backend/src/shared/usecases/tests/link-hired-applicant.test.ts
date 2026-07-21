// Tests de linkHiredApplicantToEmployee — postulante contratado → expediente (link por email).
import { describe, it, expect } from 'bun:test'
import { linkHiredApplicantToEmployee } from '../link-hired-applicant'

// ORM en memoria: Users por email+hotel, EmployeeProfile por userId, y captura de update/create.
function makeOrm(opts: { users?: any[]; profiles?: any[] } = {}) {
  const applicantUpdates: Array<{ id: string; data: any }> = []
  const orm = {
    findMany: async (model: string, f: any) => {
      if (model === 'Users') return (opts.users ?? []).filter((u) => u.email === f.email && u.hotelId === f.hotelId)
      if (model === 'EmployeeProfile') return (opts.profiles ?? []).filter((p) => p.userId === f.userId)
      return []
    },
    update: async (model: string, id: string, data: any) => { if (model === 'JobApplicant') applicantUpdates.push({ id, data }); return data },
  }
  return { orm, applicantUpdates }
}
function empleadosStub() {
  const created: any[] = []
  return { created, port: { createProfile: async (dto: any) => { const p = { id: `prof-${created.length + 1}`, ...dto }; created.push(p); return p } } }
}
const applicant = (over: any = {}) => ({ id: 'a1', hotelId: 'h1', email: 'juan@hotel.com', jobPositionId: 'jp1', hiredEmployeeId: null, ...over })

describe('linkHiredApplicantToEmployee', () => {
  it('crea el expediente y liga el back-ref cuando el user existe sin perfil', async () => {
    const { orm, applicantUpdates } = makeOrm({ users: [{ id: 'u1', email: 'juan@hotel.com', hotelId: 'h1' }], profiles: [] })
    const emp = empleadosStub()
    await linkHiredApplicantToEmployee(orm, emp.port, applicant())
    expect(emp.created).toHaveLength(1)
    expect(emp.created[0].userId).toBe('u1')
    expect(applicantUpdates).toEqual([{ id: 'a1', data: { hiredEmployeeId: 'prof-1' } }])
  })

  it('si el user ya tiene expediente, solo liga el back-ref (no duplica perfil)', async () => {
    const { orm, applicantUpdates } = makeOrm({ users: [{ id: 'u1', email: 'juan@hotel.com', hotelId: 'h1' }], profiles: [{ id: 'prof-existente', userId: 'u1' }] })
    const emp = empleadosStub()
    await linkHiredApplicantToEmployee(orm, emp.port, applicant())
    expect(emp.created).toHaveLength(0)
    expect(applicantUpdates).toEqual([{ id: 'a1', data: { hiredEmployeeId: 'prof-existente' } }])
  })

  it('NO fabrica nada si no hay user con ese email en el hotel', async () => {
    const { orm, applicantUpdates } = makeOrm({ users: [] })
    const emp = empleadosStub()
    await linkHiredApplicantToEmployee(orm, emp.port, applicant())
    expect(emp.created).toHaveLength(0)
    expect(applicantUpdates).toHaveLength(0)
  })

  it('no hace nada si el postulante ya estaba vinculado', async () => {
    const { orm, applicantUpdates } = makeOrm({ users: [{ id: 'u1', email: 'juan@hotel.com', hotelId: 'h1' }] })
    const emp = empleadosStub()
    await linkHiredApplicantToEmployee(orm, emp.port, applicant({ hiredEmployeeId: 'ya-existe' }))
    expect(emp.created).toHaveLength(0)
    expect(applicantUpdates).toHaveLength(0)
  })

  it('no hace nada si el postulante no tiene email', async () => {
    const { orm, applicantUpdates } = makeOrm({ users: [{ id: 'u1', email: 'juan@hotel.com', hotelId: 'h1' }] })
    const emp = empleadosStub()
    await linkHiredApplicantToEmployee(orm, emp.port, applicant({ email: null }))
    expect(emp.created).toHaveLength(0)
    expect(applicantUpdates).toHaveLength(0)
  })
})
