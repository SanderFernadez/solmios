// pricing-mode.ts — lee el modo de tarificación del hotel desde configuration(pricing_mode).
// per_person → precio por ocupación (OBP) hacia la OTA (#404). Se lee acá para no acoplar el
// módulo canales con el módulo pricing.

export async function readPricingMode(
  findMany: (model: string, query: any) => Promise<any[]>,
  hotelId: string,
): Promise<'per_room' | 'per_person'> {
  const rows = await findMany('Configuration', { hotelId, key: 'pricing_mode' })
  try {
    return JSON.parse(rows[0]?.value ?? '{}').mode === 'per_person' ? 'per_person' : 'per_room'
  } catch {
    return 'per_room'
  }
}
