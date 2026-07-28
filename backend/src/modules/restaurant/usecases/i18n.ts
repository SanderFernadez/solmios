// restaurant/usecases/i18n.ts — Shim de backward compat. Las funciones viven en
// shared/i18n.ts desde solmi-direct-booking F0 (0.3); este archivo re-exporta para no
// romper consumidores externos. Los usecases internos ya importan directo de shared/i18n.
export { assertNoBaseLangKey, resolveForLang } from '../../../shared/i18n'
