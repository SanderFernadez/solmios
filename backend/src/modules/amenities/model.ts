// HotelAmenities y RoomAmenities viven en src/shared/models.ts (registerSharedModels).
// Este módulo consume esas tablas vía OrmRepository, no define modelo propio.
// (Antes existía aquí `registerAmenitiesModels` — nunca invocada, redefinía los mismos
// modelos con `isActive` tipado `number` en vez de `boolean` (landmine). Eliminada 2026-07-06.)
