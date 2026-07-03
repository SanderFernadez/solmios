export const MS_PER_DAY = 86_400_000

export function nightsBetween(a: any, b: any): number {
  if (!a || !b) return 0
  const d1 = new Date(String(a).slice(0, 10)).getTime()
  const d2 = new Date(String(b).slice(0, 10)).getTime()
  return d2 > d1 ? Math.round((d2 - d1) / MS_PER_DAY) : 0
}

export function bucketByDay(items: any[], from: string, to: string, valueFn: (item: any) => number) {
  const buckets: Record<string, number> = {}
  for (const it of items) {
    const d = String(it.checkIn || it.createdAt || '').slice(0, 10)
    if (d >= from && d <= to) buckets[d] = (buckets[d] || 0) + valueFn(it)
  }
  return Object.entries(buckets).sort((a, b) => a[0].localeCompare(b[0])).map(([date, value]) => ({ date, value }))
}

export function eachDay(from: string, to: string): string[] {
  const days: string[] = []
  const start = new Date(from + 'T00:00:00')
  const end = new Date(to + 'T00:00:00')
  for (let t = start.getTime(); t <= end.getTime(); t += MS_PER_DAY) {
    days.push(new Date(t).toISOString().slice(0, 10))
  }
  return days
}

export function csvValue(v: any): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'object') return JSON.stringify(v).replace(/"/g, '""')
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
