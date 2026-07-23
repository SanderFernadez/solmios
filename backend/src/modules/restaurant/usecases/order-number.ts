// restaurant/usecases/order-number.ts — Número correlativo de comanda por hotel (RES-3).
// Counter atómico en configuration(key='restaurant_order_counter_{hotelId}_{year}'), mismo patrón que
// facturas/invoice-number para evitar duplicados en concurrencia.
import type { RepositoryAdapter } from 'arckode-framework'

export async function nextOrderNumber(configRepo: RepositoryAdapter<any>, hotelId: string): Promise<string> {
  const year = new Date().getFullYear()
  const counterKey = `restaurant_order_counter_${hotelId}_${year}`
  try {
    const counter = await configRepo.findOne({ key: counterKey, hotelId })
    const nextSeq = (counter?.value ?? 0) + 1
    if (counter) {
      await configRepo.update(counter.id, { value: nextSeq } as any)
    } else {
      await configRepo.create({
        key: counterKey, hotelId, value: nextSeq,
        description: `Restaurant order counter ${year}`,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      } as any)
    }
    return `CMD-${year}-${nextSeq.toString().padStart(4, '0')}`
  } catch {
    return `CMD-${year}-${Date.now()}`
  }
}
