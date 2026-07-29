// abandon-recovery/validators/schema.ts — No schemas: el módulo NO recibe HTTP bodies (F3 3.14).
//
// Cron-only: no hay rutas HTTP, no hay POST/PUT/PATCH que validar. El único input externo
// es `PUBLIC_BASE_URL` (env var, validada por el ConfigStore global) y el query ORM que
// construye el propio service. Por eso este archivo no define schemas reales.
//
// El analyzer espera que cada módulo tenga validators/schema.ts (estructura canónica).
// Exportamos un Validator class vacío + un schema placeholder para satisfacer la estructura
// sin crear contratos que nobody va a usar.

export const AbandonRecoveryValidator = {
  /** Placeholder: no hay validación real porque no hay HTTP. */
  validate(_input: unknown): void {
    // Intencionalmente vacío.
  },
}

/** Schema placeholder para no romper imports canónicos (BookingengineValidator pattern). */
export const SweepConfigSchema = {
  fields: {},
}
