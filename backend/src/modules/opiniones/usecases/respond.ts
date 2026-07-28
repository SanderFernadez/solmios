// opiniones/usecases/respond.ts — F0 (public-reviews 0.9)
// Stamp `respondedAt` cuando se persiste `response`. Pure function, sin deps.
// - response no-vacío → respondedAt = ahora (ISO).
// - response vacío/null → respondedAt = null (simetría con el campo response).
// - response ausente del patch → no tocar respondedAt.
// respondedAt NO está en UpdateOpinionesDTO: es computed del acto de responder, no input del API.

export function stampRespondedAt<T extends Record<string, unknown>>(patch: T): Record<string, unknown> {
  if (!Object.prototype.hasOwnProperty.call(patch, 'response')) return patch
  const value = patch.response
  return { ...patch, respondedAt: (typeof value === 'string' && value.trim() !== '') ? new Date().toISOString() : null }
}
