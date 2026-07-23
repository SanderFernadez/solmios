// compras/usecases/number.ts — Números correlativos por hotel (REQ/OC/REC). Counter atómico en
// configuration, mismo patrón que facturas/invoice-number para evitar duplicados en concurrencia.
import type { RepositoryAdapter } from 'arckode-framework'

export async function nextNumber(configRepo: RepositoryAdapter<any>, hotelId: string, prefix: string, kind: string): Promise<string> {
  const year = new Date().getFullYear()
  const counterKey = `compras_${kind}_counter_${hotelId}_${year}`
  try {
    const counter = await configRepo.findOne({ key: counterKey, hotelId })
    const nextSeq = (counter?.value ?? 0) + 1
    if (counter) {
      await configRepo.update(counter.id, { value: nextSeq } as any)
    } else {
      await configRepo.create({
        key: counterKey, hotelId, value: nextSeq,
        description: `Compras ${kind} counter ${year}`,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      } as any)
    }
    return `${prefix}-${year}-${nextSeq.toString().padStart(4, '0')}`
  } catch {
    return `${prefix}-${year}-${Date.now()}`
  }
}
