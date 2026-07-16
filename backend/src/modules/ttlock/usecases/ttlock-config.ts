function safeParse(v: any) { if (typeof v !== 'string') return v; try { return JSON.parse(v) } catch { return v } }

export async function generateCodeForReservation(
  reservationId: string,
  hotelId: string,
  lockDevicesRepo: any,
  lockCodesRepo: any,
  getAccessTokenFn: Function,
  addKeyboardPasswordFn: Function,
  randomPinFn: Function,
  getConfigFn: (hotelId: string) => Promise<any>,
  findReservationFn: (id: string) => Promise<any>,
  auth?: any,
): Promise<any> {
  const res = await findReservationFn(reservationId) as any
  if (!res) throw new Error('Reserva no encontrada')
  if (res.hotelId !== hotelId) throw new Error('Sin acceso a esta reserva')
  if (auth) auth.assertOwnership(res.hotelId, hotelId, undefined, 'super_admin')
  const lock = (await lockDevicesRepo.findMany({ roomId: res.roomId }))[0] as any
  if (!lock?.ttlockLockId) throw new Error('La habitación no tiene cerradura TTLock')
  const password = randomPinFn()
  // Cerradura OFFLINE: el gateway no puede alcanzarla, así que NO intentamos empujar el PIN
  // al hardware (fallaría). Registramos el código como 'pending' — la fila queda con el PIN
  // pre-asignado, lista para reintentar/regenerar cuando la cerradura vuelva, sin romper el
  // flujo automático (webhook de la seña). Sin `ttlockKeyboardPwdId` no hay PIN físico que
  // borrar después, así que revoke/expire lo tratan como no-op de hardware.
  if (lock.status === 'offline') {
    return await lockCodesRepo.create({ lockId: lock.id, hotelId, reservationId, code: password, codeType: 'time', startDate: String(res.checkIn).slice(0, 10), endDate: String(res.checkOut).slice(0, 10), status: 'pending', ttlockKeyboardPwdId: '', sentVia: '' })
  }
  const parsed = await getConfigFn(hotelId)
  if (!parsed?.accessToken) throw new Error('TTLock no conectado')
  const creds = { clientId: parsed.clientId, accessToken: parsed.accessToken, region: parsed.region, addType: parsed.addType }
  const startMs = new Date(res.checkIn).getTime(); const endMs = new Date(res.checkOut).getTime()
  let pwdId = ''
  try { const r = await addKeyboardPasswordFn(creds, Number(lock.ttlockLockId), password, startMs, endMs); pwdId = r.keyboardPwdId || '' } catch (e: any) { throw new Error(e.message || 'No se pudo crear el PIN') }
  return await lockCodesRepo.create({ lockId: lock.id, hotelId, reservationId, code: password, codeType: 'time', startDate: String(res.checkIn).slice(0, 10), endDate: String(res.checkOut).slice(0, 10), status: 'active', ttlockKeyboardPwdId: pwdId, sentVia: '' })
}
