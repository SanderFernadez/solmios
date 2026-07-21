// shared/usecases/sync-room-amenities-csv.ts — Denormaliza RoomAmenities → Rooms.amenities (CSV).
// La dispara el connector amenities-habitaciones desde onRoomAmenitiesUpdated. Vive acá (no en el
// connector) porque los connectors solo deben WIREAR.
//
// Por qué: RoomAmenities (relacional) es la fuente de verdad (la usa el form de habitación y el
// booking widget). Pero Rooms.amenities (CSV) es un campo vestigial que NADIE escribe y que SÍ leen
// ai-recepcionista (contexto del LLM) y bookingengine/availability → veían siempre vacío/default.
// Esto lo mantiene sincronizado. Non-destructivo: solo escribe un campo que hoy queda en ''.
export async function syncRoomAmenitiesCsv(orm: any, roomId: string, amenityKeys: string[]): Promise<void> {
  await orm.update('Rooms', roomId, { amenities: (amenityKeys ?? []).join(',') })
}
