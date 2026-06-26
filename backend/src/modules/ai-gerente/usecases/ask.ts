// ai-gerente/usecases/ask.ts — Agregación de KPIs reales del hotel + llamada al LLM.
// Es el núcleo de M17: convierte datos operativos en contexto para el gerente IA.

const DAY_MS = 86_400_000

/** Agrega los KPIs operativos del hotel desde reservations + rooms (vía ORM). */
export async function getHotelKpis(reservationRepo: any, roomRepo: any, hotelId: string) {
  const today = new Date().toISOString().split('T')[0]
  const monthPrefix = today.slice(0, 7)
  const [reservations, rooms] = await Promise.all([
    reservationRepo.findMany({ hotelId }).catch(() => []),
    roomRepo.findMany({ hotelId }).catch(() => []),
  ])
  const activeToday = reservations.filter((r: any) =>
    r.checkIn && r.checkOut && r.checkIn <= today && r.checkOut > today && r.status !== 'cancelled',
  ).length
  const revenueMonth = reservations
    .filter((r: any) => (r.createdAt || r.checkIn || '').startsWith(monthPrefix) && r.status !== 'cancelled')
    .reduce((s: number, r: any) => s + (Number(r.totalAmount) || 0), 0)
  const cancelled = reservations.filter((r: any) => r.status === 'cancelled').length
  const nights = reservations.reduce((s: number, r: any) => {
    if (!r.checkIn || !r.checkOut) return s
    return s + Math.max(1, Math.round((new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime()) / DAY_MS))
  }, 0)
  return {
    fecha: today,
    habitaciones_totales: rooms.length,
    reservas_totales: reservations.length,
    ocupacion_hoy: `${activeToday}/${rooms.length}`,
    revenue_mes: revenueMonth,
    cancelaciones: cancelled.length === 0 ? reservations.filter((r: any) => r.status === 'cancelled').length : cancelled,
    adr: nights ? Math.round(revenueMonth / nights) : 0,
    noches_totales: nights,
  }
}

/** Llama al LLM (DeepSeek, OpenAI-compatible). Devuelve '' si no hay API key. */
async function callLlm(systemPrompt: string, userQuery: string, apiKey: string): Promise<string> {
  if (!apiKey) return ''
  const endpoint = process.env.LLM_ENDPOINT || 'https://api.deepseek.com/v1/chat/completions'
  const model = process.env.LLM_MODEL || 'deepseek-chat'
  const r = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userQuery },
      ],
      temperature: 0.4,
      max_tokens: 600,
    }),
    signal: AbortSignal.timeout(20_000),
  })
  if (!r.ok) return ''
  const j = (await r.json()) as any
  return j?.choices?.[0]?.message?.content ?? ''
}

/** Genera la respuesta del gerente IA. Si no hay LLM, devuelve los KPIs crudos como fallback. */
export async function askGerente(
  query: string,
  kpis: Record<string, unknown>,
  hotelName: string,
  apiKey: string,
): Promise<{ response: string; confidence: number }> {
  const system = `Sos el gerente IA del hotel "${hotelName}". Respondé en español rioplatense, conciso y accionable, usando ÚNICAMENTE estos datos reales del sistema (no inventes números):\n${JSON.stringify(kpis, null, 2)}\n\nSi la pregunta no se puede responder con los datos disponibles, decilo claramente y sugerí qué información falta. Sé directo, como un gerente experimentado hablando con el dueño.`
  const text = await callLlm(system, query, apiKey)
  if (!text) {
    return {
      response:
        `📊 ${hotelName} — ${kpis.fecha}\n` +
        `• Ocupación hoy: ${kpis.ocupacion_hoy} habitaciones\n` +
        `• Reservas totales: ${kpis.reservas_totales}\n` +
        `• Revenue del mes: $${kpis.revenue_mes}\n` +
        `• Cancelaciones: ${kpis.cancelaciones}\n` +
        `• ADR: $${kpis.adr}\n\n` +
        `_(LLM no configurado — mostrando KPIs crudos. Configurá DEEPSEEK_API_KEY o LLM_API_KEY en .env para respuestas con IA.)_`,
      confidence: 0.5,
    }
  }
  return { response: text, confidence: 0.85 }
}
