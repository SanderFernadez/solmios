// Seasons, RoomRates, RoomBlocks y RateRestrictions viven en src/shared/models.ts
// (registerSharedModels). Este módulo consume esas tablas vía OrmRepository, no
// define modelo propio.
// (Antes existía aquí `registerPricingModels` — nunca invocada, redefinía los mismos
// modelos y quedaba como trampa de descarte silencioso de campos. Eliminada 2026-07-06.)
