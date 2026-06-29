// src/services/guarantee-pin.ts — Hashing del PIN de tarjeta de garantía (MisterPlan).
// El PIN se guarda en `configuration` (key: guarantee_pin) hasheado con SHA-256,
// usando hotelId + JWT_SECRET como pepper. Nunca se guarda en claro.
import crypto from 'node:crypto'

/** Hashea un PIN con pepper (hotelId + JWT_SECRET). */
export function hashGuaranteePin(pin: string, hotelId: string): string {
  const secret = process.env.JWT_SECRET || 'dev-fallback-secret'
  return crypto.createHash('sha256').update(`${hotelId}:${pin}:${secret}`).digest('hex')
}

/** Verifica un PIN contra el hash almacenado (comparación a tiempo constante). */
export function verifyGuaranteePin(pin: string, hotelId: string, storedHash: string): boolean {
  const computed = hashGuaranteePin(pin, hotelId)
  if (computed.length !== storedHash.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(storedHash))
  } catch {
    return false
  }
}
