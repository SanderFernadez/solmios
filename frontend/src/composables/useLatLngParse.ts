/**
 * Extrae coordenadas de lo que el usuario pegue desde Google Maps.
 *
 * Existe porque el mapa se muestra con un iframe de Google (`output=embed`), que al ser de otro
 * origen no puede avisar dónde se hizo clic. Sin esto, la única forma de mover el pin sería
 * escribir latitud y longitud a mano.
 *
 * Formatos cubiertos (los que Google entrega realmente):
 *  - `18.4861, -69.9312`                          clic derecho → copiar coordenadas
 *  - `https://www.google.com/maps/@18.4861,-69.9312,17z`   URL de la barra de direcciones
 *  - `https://maps.google.com/?q=18.4861,-69.9312`         enlace compartido
 *
 * Devuelve null si no hay un par válido, para no pisar la ubicación guardada con texto a medias.
 */
export function parseLatLng(text: string): { lat: number; lng: number } | null {
  if (!text) return null
  const patterns = [
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,              // /@lat,lng,17z
    /[?&]q=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,      // ?q=lat,lng
    /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/,         // lat, lng suelto
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (!m) continue
    const lat = Number(m[1])
    const lng = Number(m[2])
    // Fuera de rango = no son coordenadas (probablemente sea otro par de números de la URL).
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng }
    }
  }
  return null
}
