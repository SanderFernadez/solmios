import { NotFoundError, AuthError } from 'arckode-framework'
import { hashGuaranteePin, verifyGuaranteePin } from '../../../services/guarantee-pin'

export async function setGuaranteePin(orm: any, userRepo: any, user: any, body: any): Promise<{ success: boolean }> {
  const hotelId = await resolveHotelIdForUser(orm, userRepo, user)
  if (!hotelId) throw new AuthError('Hotel no encontrado')
  const { pin } = body as { pin?: string }
  if (!pin || !/^\d{4,8}$/.test(String(pin))) throw new Error('PIN inválido (debe ser de 4 a 8 dígitos)')
  const hash = hashGuaranteePin(String(pin), hotelId)
  const existing = (await orm.findMany('Configuration', { hotelId, key: 'guarantee_pin' }))[0] as any
  if (existing) await orm.update('Configuration', existing.id, { value: hash })
  else await orm.create('Configuration', { id: crypto.randomUUID(), hotelId, key: 'guarantee_pin', value: hash })
  return { success: true }
}

export async function getGuaranteeHasPin(orm: any, userRepo: any, user: any): Promise<{ hasPin: boolean }> {
  const hotelId = await resolveHotelIdForUser(orm, userRepo, user)
  if (!hotelId) throw new AuthError('Hotel no encontrado')
  const row = (await orm.findMany('Configuration', { hotelId, key: 'guarantee_pin' }))[0] as any
  return { hasPin: !!row }
}

export async function unlockGuaranteeCard(orm: any, repo: any, userRepo: any, reservationId: string, user: any, body: any, auth?: any): Promise<any> {
  const r = await repo.findById(reservationId) as any
  if (!r) throw new NotFoundError('Reserva no encontrada')
  if (auth) auth.assertOwnership(r, { hotelId: r.hotelId })
  const hid = await resolveHotelIdForUser(orm, userRepo, user)
  if (!hid) throw new AuthError('Hotel no encontrado')
  if (r.hotelId !== hid) throw new AuthError('Sin acceso a esta reserva')
  if (!r.hasGuaranteeCard && !r.cardLast4) throw new Error('Esta reserva no tiene tarjeta de garantía')
  const pinRow = (await orm.findMany('Configuration', { hotelId: hid, key: 'guarantee_pin' }))[0] as any
  if (!pinRow?.value) throw new Error('No hay PIN de garantía configurado')
  const { pin } = body as { pin?: string }
  if (!pin || !verifyGuaranteePin(String(pin), hid, String(pinRow.value))) throw new AuthError('PIN incorrecto')
  return { cardHolder: r.cardHolder || '', cardBrand: r.cardBrand || '', cardLast4: r.cardLast4 || '', cardExpMonth: r.cardExpMonth || '', cardExpYear: r.cardExpYear || '' }
}

async function resolveHotelIdForUser(orm: any, userRepo: any, user: any): Promise<string | undefined> {
  if (user?.hotelId && user?.hotelId !== 'platform') return user.hotelId
  if (user?.id && user?.role !== 'super_admin') {
    const rows = await userRepo.findMany({ id: user.id }) as any[]
    const row: any = rows?.[0]
    if (row?.hotelId) return row.hotelId
  }
  return ((await orm?.findMany?.('Hotels', {}))[0] as any)?.id
}
