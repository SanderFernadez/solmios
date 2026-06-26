import { getSystemIntents } from './seed-intents'

export async function seedHotelIntents(intentRepo: any, hotelId: string): Promise<{ seeded: number }> {
  const existing = await intentRepo.count({ hotelId, isSystem: 1 })
  if (existing > 0) return { seeded: 0 }
  const intents = getSystemIntents(hotelId)
  for (const dto of intents) {
    await intentRepo.create({
      id: crypto.randomUUID(), ...dto, isSystem: 1, isActive: 1, requiresAuth: 0,
    } as any)
  }
  return { seeded: intents.length }
}
