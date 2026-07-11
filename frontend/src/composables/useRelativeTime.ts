// composables/useRelativeTime.ts — "hace 12 segundos" / "hace 3 min" / "hace 2 h".
// Función pura: recibe el instante actual (de useNow) para que el texto sea reactivo.

export function relativeTime(from: string | Date | null | undefined, nowMs: number): string {
  if (!from) return '—'
  const d = typeof from === 'string' ? new Date(from) : from
  const t = d.getTime()
  if (Number.isNaN(t)) return '—'
  const diff = Math.max(0, Math.floor((nowMs - t) / 1000))
  if (diff < 60) return `Hace ${diff} segundo${diff === 1 ? '' : 's'}`
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`
  const days = Math.floor(diff / 86400)
  return `Hace ${days} día${days === 1 ? '' : 's'}`
}
