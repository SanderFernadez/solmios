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
        title: 'Tu próximo destino',
        subtitle: 'Reservá directo y aprovechá el mejor precio.',
        ctaText: 'Reservar',
        backgroundMediaId: null,
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
      return { title: 'Habitaciones', ctaText: 'Ver tarifas' }
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
