// composables/useHotelMetaTags.ts — meta description + Open Graph + Twitter Card + canonical
// de la landing pública de un hotel (auditoría UX/SEO — hallazgo: el HTML servido SIEMPRE tenía
// el title/description genéricos de la SPA ("SolmiOS — Hospitality OS"), y no existía NINGÚN tag
// og:*/twitter:*. Compartir el link de un hotel en WhatsApp/Facebook/Twitter mostraba branding
// de la app, no del hotel — pérdida de conversión real, no solo un detalle técnico.
//
// Limitación honesta: esto es una SPA sin SSR — estos tags se inyectan por DOM después de que el
// JS corre. Un crawler que NO ejecuta JS (algunos bots de preview simples) seguirá viendo el HTML
// estático genérico. Googlebot/Facebook/WhatsApp SÍ ejecutan JS antes de leer meta tags en la
// gran mayoría de los casos, así que esto cubre el caso real dominante — pero no es SSR real.
// Mismo patrón de inyección idempotente por DOM que useHotelJsonLd.ts (watch immediate + cleanup).

import { onBeforeUnmount, watch, type Ref } from 'vue'
import type { PublicHotelInfo, PublicHotelMedia } from '@/types'

export interface UseHotelMetaTagsInput {
  hotel: Ref<PublicHotelInfo | null>
  media: Ref<PublicHotelMedia | null>
}

const DEFAULT_DESCRIPTION = 'SolmiOS — Hospitality OS. Sistema integral de gestión hotelera con planning, reservas, channel manager y pagos.'
const MANAGED_IDS = ['meta-description', 'og-title', 'og-description', 'og-image', 'og-url', 'og-type', 'twitter-card', 'twitter-title', 'twitter-description', 'twitter-image', 'canonical-link']

function setMeta(property: 'name' | 'property', key: string, id: string, content: string): void {
  let tag = document.getElementById(id) as HTMLMetaElement | null
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute(property, key)
    tag.id = id
    document.head.appendChild(tag)
  }
  tag.setAttribute('content', content)
}

function setLink(rel: string, id: string, href: string): void {
  let tag = document.getElementById(id) as HTMLLinkElement | null
  if (!tag) {
    tag = document.createElement('link')
    tag.setAttribute('rel', rel)
    tag.id = id
    document.head.appendChild(tag)
  }
  tag.setAttribute('href', href)
}

/** Descripción para meta/OG/Twitter: la del hotel (title corto como fallback), truncada a ~160
 *  caracteres (límite práctico que Google/redes sociales respetan antes de cortar con "…"). */
function metaDescriptionFor(h: PublicHotelInfo): string {
  const raw = (h.description || h.title || '').trim()
  if (!raw) return DEFAULT_DESCRIPTION
  return raw.length > 160 ? `${raw.slice(0, 157)}…` : raw
}

export function useHotelMetaTags(input: UseHotelMetaTagsInput): void {
  const { hotel, media } = input

  function upsert() {
    if (typeof document === 'undefined') return
    const h = hotel.value
    if (!h) return

    const description = metaDescriptionFor(h)
    const image = media.value?.hero?.[0]?.url ?? h.logo ?? ''
    const url = typeof window !== 'undefined' ? window.location.href : `https://hotel.zx89.site/h/${h.slug}`

    setMeta('name', 'description', 'meta-description', description)
    setMeta('property', 'og:title', 'og-title', h.name)
    setMeta('property', 'og:description', 'og-description', description)
    setMeta('property', 'og:type', 'og-type', 'website')
    setMeta('property', 'og:url', 'og-url', url)
    if (image) setMeta('property', 'og:image', 'og-image', image)
    setMeta('name', 'twitter:card', 'twitter-card', image ? 'summary_large_image' : 'summary')
    setMeta('name', 'twitter:title', 'twitter-title', h.name)
    setMeta('name', 'twitter:description', 'twitter-description', description)
    if (image) setMeta('name', 'twitter:image', 'twitter-image', image)
    setLink('canonical', 'canonical-link', url)
  }

  watch([hotel, media], upsert, { immediate: true })

  // Al desmontar, restaurar el default de la SPA — mismo criterio que document.title en
  // hotel-landing.vue (no filtrar branding de un hotel a otras páginas del panel).
  onBeforeUnmount(() => {
    if (typeof document === 'undefined') return
    setMeta('name', 'description', 'meta-description', DEFAULT_DESCRIPTION)
    for (const id of MANAGED_IDS) {
      if (id === 'meta-description') continue
      document.getElementById(id)?.remove()
    }
  })
}
