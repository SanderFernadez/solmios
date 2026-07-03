export function safeParse(v: any): any {
  if (typeof v !== 'string') return v
  try { return JSON.parse(v) } catch { return v }
}
