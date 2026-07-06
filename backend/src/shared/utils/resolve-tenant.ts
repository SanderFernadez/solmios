// shared/utils/resolve-tenant.ts — Resolución multi-tenant del hotelId desde el request.
//
// REGLA: el hotelId sale SIEMPRE del token. Solo super_admin puede targetear otro
// hotel vía ?hotelId= o body.hotelId. Un merchant queda forzado a su propio hotel.
//
// Mata el anti-patrón `req.query.hotelId || req.user.hotelId`, donde el que llama
// elige el tenant y el token es solo fallback → fuga cross-tenant explotable.

export function resolveTenant(req: any): string | undefined {
  const user = req?.user
  if (user?.role === 'super_admin') {
    const requested = req?.query?.hotelId ?? req?.body?.hotelId
    return (requested || user?.hotelId) as string | undefined
  }
  return user?.hotelId as string | undefined
}
