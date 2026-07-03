function safeParse(v: any) { if (typeof v !== 'string') return v; try { return JSON.parse(v) } catch { return v } }

export async function getConfig(orm: any, hotelId: string, key: string): Promise<any> {
  const row = (await orm.findMany('Configuration', { hotelId, key }))[0] as any
    || (await orm.findMany('Configuration', { hotelId: 'platform', key }))[0] as any
  return { valor: row ? safeParse(row.value) : null }
}

export async function setConfig(orm: any, body: { clave: string; valor: any; hotelId?: string }): Promise<any> {
  const { clave, valor, hotelId } = body
  if (!clave || valor === undefined) throw new Error('clave y valor requeridos')
  const existing = (await orm.findMany('Configuration', { hotelId: hotelId || 'platform', key: clave }))[0] as any
  const val = typeof valor === 'object' ? JSON.stringify(valor) : String(valor)
  if (existing) await orm.update('Configuration', existing.id, { value: val })
  else await orm.create('Configuration', { id: crypto.randomUUID(), hotelId: hotelId || 'platform', key: clave, value: val })
  return { success: true }
}
