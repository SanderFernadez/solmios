import type { ValidationRule } from 'arckode-framework'

const STATUS_ENUM = ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show']
const CHANNEL_ENUM = ['direct', 'booking', 'airbnb', 'expedia', 'agoda', 'trip', 'phone', 'email', 'walk_in']
const PRECHECKIN_ENUM = ['pending', 'sent', 'completed', 'expired']

export const CreateReservasSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  roomId: { type: 'string' as const, required: true },
  checkIn: { type: 'string' as const, required: true, pattern: /^\d{4}-\d{2}-\d{2}$/ },
  checkOut: { type: 'string' as const, required: true, pattern: /^\d{4}-\d{2}-\d{2}$/ },
  totalAmount: { type: 'number' as const, required: true, min: 0 },
  guestId: { type: 'string' as const },
  channel: { type: 'string' as const, enum: CHANNEL_ENUM },
  status: { type: 'string' as const, enum: STATUS_ENUM },
  currency: { type: 'string' as const, min: 3, max: 3 },
  adults: { type: 'number' as const, min: 1, max: 20 },
  children: { type: 'number' as const, min: 0, max: 20 },
  deposit: { type: 'number' as const, min: 0 },
  notes: { type: 'string' as const, max: 2000 },
  source: { type: 'string' as const, max: 50 },
  externalLocator: { type: 'string' as const, max: 100 },
  commission: { type: 'number' as const, min: 0, max: 100 },
  commissionAmount: { type: 'number' as const, min: 0 },
  paymentMethod: { type: 'string' as const, max: 50 },
  pendingAmount: { type: 'number' as const, min: 0 },
  autoSendEnabled: { type: 'boolean' as const },
  preCheckinStatus: { type: 'string' as const, enum: PRECHECKIN_ENUM },
  groupId: { type: 'string' as const },
  otaNotes: { type: 'string' as const, max: 2000 },
  depositPercentage: { type: 'number' as const, min: 0, max: 100 },
  depositStatus: { type: 'string' as const },
  ownerNotes: { type: 'string' as const, max: 2000 },
  regime: { type: 'string' as const },
  promoCode: { type: 'string' as const, max: 50 },
  communicateClient: { type: 'string' as const },
  // F3 MisterPlan: condiciones + otros cobros
  gdprAccepted: { type: 'boolean' as const },
  marketingAccepted: { type: 'boolean' as const },
  termsAccepted: { type: 'boolean' as const },
  otherCharges: { type: 'number' as const, min: 0 },
  // Tarjeta de garantía (MisterPlan): datos parciales, sin número completo ni CVV.
  hasGuaranteeCard: { type: 'boolean' as const },
  cardHolder: { type: 'string' as const, max: 100 },
  cardBrand: { type: 'string' as const, max: 20 },
  cardLast4: { type: 'string' as const, max: 4 },
  cardExpMonth: { type: 'string' as const, max: 2 },
  cardExpYear: { type: 'string' as const, max: 4 },
}

export const UpdateReservasSchema: Record<string, ValidationRule> = {
  roomId: { type: 'string' as const },
  checkIn: { type: 'string' as const, pattern: /^\d{4}-\d{2}-\d{2}$/ },
  checkOut: { type: 'string' as const, pattern: /^\d{4}-\d{2}-\d{2}$/ },
  totalAmount: { type: 'number' as const, min: 0 },
  guestId: { type: 'string' as const },
  channel: { type: 'string' as const, enum: CHANNEL_ENUM },
  status: { type: 'string' as const, enum: STATUS_ENUM },
  currency: { type: 'string' as const, min: 3, max: 3 },
  adults: { type: 'number' as const, min: 1, max: 20 },
  children: { type: 'number' as const, min: 0, max: 20 },
  deposit: { type: 'number' as const, min: 0 },
  notes: { type: 'string' as const, max: 2000 },
  source: { type: 'string' as const, max: 50 },
  externalLocator: { type: 'string' as const, max: 100 },
  commission: { type: 'number' as const, min: 0, max: 100 },
  commissionAmount: { type: 'number' as const, min: 0 },
  paymentMethod: { type: 'string' as const, max: 50 },
  pendingAmount: { type: 'number' as const, min: 0 },
  autoSendEnabled: { type: 'boolean' as const },
  preCheckinStatus: { type: 'string' as const, enum: PRECHECKIN_ENUM },
  groupId: { type: 'string' as const },
  otaNotes: { type: 'string' as const, max: 2000 },
  // F3 MisterPlan: condiciones + otros cobros
  gdprAccepted: { type: 'boolean' as const },
  marketingAccepted: { type: 'boolean' as const },
  termsAccepted: { type: 'boolean' as const },
  otherCharges: { type: 'number' as const, min: 0 },
  // Tarjeta de garantía (MisterPlan): datos parciales, sin número completo ni CVV.
  hasGuaranteeCard: { type: 'boolean' as const },
  cardHolder: { type: 'string' as const, max: 100 },
  cardBrand: { type: 'string' as const, max: 20 },
  cardLast4: { type: 'string' as const, max: 4 },
  cardExpMonth: { type: 'string' as const, max: 2 },
  cardExpYear: { type: 'string' as const, max: 4 },
}

export const ReservasValidator = { create: CreateReservasSchema, update: UpdateReservasSchema }
