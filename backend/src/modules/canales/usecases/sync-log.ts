function safeParse(v: any) { if (typeof v !== 'string') return v; try { return JSON.parse(v) } catch { return v } }

export async function getSyncLog(orm: any, hotelId?: string): Promise<any[]> {
  if (!orm) return []
  const rows = await orm.findMany('Configuration', { hotelId: hotelId || 'platform', key: 'channex_sync_log' })
  const raw = (rows[0] as any)?.value; return raw ? JSON.parse(raw) : []
}
