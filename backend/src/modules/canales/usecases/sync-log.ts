const SYNC_ACTION_LABELS: Record<string, string> = {
  sync_property: 'Sincronización de propiedad',
  ingest_bookings: 'Recepción de reservas',
}

/** Convierte el objeto `details` (json) del sync_log en un texto legible para la tabla del panel. */
export function formatSyncDetails(d: any): string {
  if (d === null || d === undefined) return ''
  let obj = d
  if (typeof d === 'string') { try { obj = JSON.parse(d) } catch { return d } }
  if (!obj || typeof obj !== 'object') return String(d)
  return Object.entries(obj)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${k}: ${v}`)
    .join(' · ')
}

/**
 * Historial de sincronización desde la tabla `sync_log` (donde el sync/ingest escriben).
 * Antes se leía de Configuration('channex_sync_log'), fuente que nadie escribía → el historial
 * salía siempre vacío. Devuelve los últimos 50, más nuevos primero, con acción/detalle legibles.
 */
export async function getSyncLog(syncLogRepo: any, hotelId?: string): Promise<any[]> {
  if (!syncLogRepo) return []
  const rows = (await syncLogRepo.findMany(hotelId ? { hotelId } : {})) as any[]
  return rows
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .slice(0, 50)
    .map((r) => ({
      id: r.id,
      channel: r.channel,
      status: r.status,
      createdAt: r.createdAt,
      action: SYNC_ACTION_LABELS[r.action] || r.action,
      details: formatSyncDetails(r.details),
    }))
}
