// Carga perezosa del SDK de Google Maps, con la key tomada de configuración (NUNCA hardcodeada).
//
// La key se administra en Admin → Configuración → Integraciones y se guarda en
// configuration(hotelId:'platform', key:'google_maps'). Cada hotel la hereda por el fallback
// a 'platform' que ya hace `getConfig`.
//
// Si no hay key configurada, `loadGoogleMaps()` devuelve null y la pantalla usa el iframe embed
// (que no requiere key pero no permite mover el pin con el mouse). Es degradación, no error:
// la plataforma tiene que seguir funcionando sin cuenta de Google.

import { ConfigService } from '@/services/Platform.service'

const SCRIPT_ID = 'google-maps-sdk'

/** Promesa compartida: el SDK se inyecta UNA sola vez aunque se entre y salga de la pestaña. */
let loader: Promise<typeof google.maps | null> | null = null

async function fetchApiKey(): Promise<string> {
  try {
    const cfg = await ConfigService.get('google_maps')
    const key = (cfg as { apiKey?: string } | null)?.apiKey
    return typeof key === 'string' ? key.trim() : ''
  } catch {
    return ''
  }
}

/**
 * Devuelve `google.maps` listo para usar, o null si no hay key configurada / falló la carga.
 * El llamador decide el fallback; acá nunca se lanza.
 */
export function loadGoogleMaps(): Promise<typeof google.maps | null> {
  if (loader) return loader
  loader = (async () => {
    const key = await fetchApiKey()
    if (!key) return null
    if (typeof window !== 'undefined' && window.google?.maps) return window.google.maps

    return new Promise<typeof google.maps | null>((resolve) => {
      const existing = document.getElementById(SCRIPT_ID)
      if (existing) {
        existing.addEventListener('load', () => resolve(window.google?.maps ?? null))
        existing.addEventListener('error', () => resolve(null))
        return
      }
      const s = document.createElement('script')
      s.id = SCRIPT_ID
      s.async = true
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&language=es`
      // Una key inválida o restringida a otro dominio termina acá: se resuelve null y la pantalla
      // cae al iframe, en vez de quedarse con un contenedor gris sin explicación.
      s.onerror = () => resolve(null)
      s.onload = () => resolve(window.google?.maps ?? null)
      document.head.appendChild(s)
    })
  })()
  return loader
}

/** Para tests / cambio de key en caliente: obliga a releer la configuración. */
export function resetGoogleMapsLoader(): void {
  loader = null
}
