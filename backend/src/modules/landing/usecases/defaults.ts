// landing/usecases/defaults.ts — Config default por type (F1, spec lines 44-53).
//
// El seeder los planta al primer GET de un hotel sin bloques. Son un piso razonable
// para que la landing pública se vea bien sin tuning manual — el admin los pisa vía
// PUT /api/landing. El shape de cada type está fijo en el spec (no se inventa).
import type { LandingBlockType } from '../types'

/**
 * Devuelve el config default para un `type`. Cada type tiene su shape documentado en
 * spec.md (Requirement: Config JSON por bloque). Mantener sincronizado con el spec
 * y con el frontend (cada Vue Block espera estas keys).
 */
export function defaultConfigFor(type: LandingBlockType): Record<string, unknown> {
  switch (type) {
    case 'hero':
      return {
        // FIX (auditoría UX/SEO) — antes sembraba un título/subtítulo fijo genérico ("Tu
        // próximo destino") que SIEMPRE ganaba sobre el fallback al nombre real del hotel
        // (HeroBlock.vue: `cfg.title || hotel.title || hotel.name` — el fallback nunca se
        // activaba porque cfg.title nunca estaba vacío). El H1 de CADA hotel nuevo era idéntico
        // y no-descriptivo — mal para SEO/diferenciación. String vacío → el frontend cae al
        // nombre/descripción real del hotel out-of-the-box; el admin lo pisa si quiere un
        // título de marketing distinto.
        title: '',
        subtitle: '',
        ctaText: 'Reservar',
        backgroundMediaId: null,
        // FIX 2026-07-31 — buscador inline en el hero. Default enabled:true: es el elemento
        // central del hero (feedback de usuario: apagado por default lo dejaba invisible sin
        // motivo, contradice el propósito del feature). Hoteles YA seedeados antes de este
        // flip no tienen la key en su config persistido — el frontend sigue leyendo con
        // optional chaining (config.searchBar?.enabled), nunca asumir que existe.
        searchBar: { enabled: true, ctaText: 'Buscar disponibilidad' },
      }
    case 'trust-badges':
      return {
        title: '',
        items: [
          { icon: 'rate', text: 'Mejor tarifa garantizada' },
          { icon: 'refund', text: 'Cancelación flexible' },
          { icon: 'secure', text: 'Pago 100% seguro' },
          { icon: 'no-fee', text: 'Sin comisiones' },
          { icon: 'direct', text: 'Reserva directa' },
        ],
      }
    case 'storytelling':
      return {
        // Título genérico aceptable acá (no es el H1 de la página — es una sección de apoyo,
        // mismo criterio que 'Habitaciones'/'Servicios' abajo). `description` vacío a propósito:
        // sin inventar copy de marketing sobre un hotel que no lo escribió (mismo criterio que
        // hero.title/subtitle — ver FIX arriba). El bloque no renderiza si description está
        // vacío Y no hay fotos elegidas (ver hotel-landing.vue:shouldRender).
        title: 'Vive una experiencia única',
        description: '',
        linkText: 'Ver habitaciones',
        mediaIds: [],
      }
    case 'gallery':
      return { title: 'Galería' }
    case 'amenities':
      return { title: 'Servicios' }
    case 'location':
      return { title: 'Ubicación', description: '' }
    case 'reviews':
      return { title: 'Opiniones de huéspedes', maxItems: 6 }
    case 'rooms':
      return {
        title: 'Habitaciones',
        ctaText: 'Ver tarifas',
        showSpecs: true,
        featuredRoomId: null,
        featuredBadgeText: 'Más reservada',
      }
    case 'faq':
      return {
        title: 'Preguntas frecuentes',
        items: [
          { question: '¿A qué hora es el check-in?', answer: 'A partir de las 15:00.' },
          { question: '¿A qué hora es el check-out?', answer: 'Hasta las 12:00.' },
        ],
      }
    case 'cta':
      return {
        title: 'Reservá directo',
        subtitle: 'Mejor precio garantizado cuando reservás con nosotros.',
        buttonText: 'Reservar ahora',
      }
    case 'footer':
      return { copyright: '', links: [] }
    default: {
      // Exhaustividad: si alguien agrega un type al catálogo sin darle default, TS bardea
      // acá. Runtime nunca debería llegar — el usecase valida el enum antes.
      const _exhaustive: never = type
      return {}
    }
  }
}
