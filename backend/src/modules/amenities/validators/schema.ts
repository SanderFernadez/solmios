import type { ValidationRule } from 'arckode-framework'

const arrayType = 'array' as any

export const UpdateHotelAmenitiesSchema: Record<string, ValidationRule> = {
  amenities: { type: arrayType, required: true },
}

export const UpdateRoomAmenitiesSchema: Record<string, ValidationRule> = {
  amenities: { type: arrayType, required: true },
}

export const AmenitiesValidator = {
  updateHotel: UpdateHotelAmenitiesSchema,
  updateRoom: UpdateRoomAmenitiesSchema,
}
