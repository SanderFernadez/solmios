// ai-gerente/usecases/ask.ts — Núcleo del Gerente IA: KPIs + loop function-calling con tools administrativas.
import { MANAGER_TOOLS, executeManagerTool, type ToolRepos } from './tools'

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
    r.checkIn && r.checkOut && r.checkIn <= today && r.checkOut > today && r.status !== 'cancelled' && r.status !== 'blocked',
  ).length
  const revenueMonth = reservations
    .filter((r: any) => (r.createdAt || r.checkIn || '').startsWith(monthPrefix) && r.status !== 'cancelled' && r.status !== 'blocked')
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
    cancelaciones: cancelled,
    adr: nights ? Math.round(revenueMonth / nights) : 0,
    noches_totales: nights,
  }
}

/** Llama al LLM (OpenAI-compatible) con tools. Devuelve {content, tool_calls}. '' si no hay API key. */
async function callLlmRaw(messages: any[], apiKey: string, tools?: any[]): Promise<{ content: string; tool_calls?: any[] }> {
  if (!apiKey) return { content: '' }
  const endpoint = process.env.LLM_ENDPOINT || 'https://api.deepseek.com/v1/chat/completions'
  const model = process.env.LLM_MODEL || 'deepseek-chat'
  const body: any = { model, messages, temperature: 0.4, max_tokens: 800 }
  if (tools?.length) { body.tools = tools; body.tool_choice = 'auto' }
  const r = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25_000),
  })
  if (!r.ok) return { content: '' }
  const j = (await r.json()) as any
  const msg = j?.choices?.[0]?.message
  return { content: msg?.content ?? '', tool_calls: msg?.tool_calls }
}

const SYSTEM_BASE = (hotelName: string, kpis: Record<string, unknown>) =>
  `Sos el gerente IA del hotel "${hotelName}". Respondé en español rioplatense, conciso y accionable. ` +
  `Tenés tools para EJECUTAR acciones reales sobre el sistema (crear/cancelar reservas, bloquear habitaciones, cambiar precios, check-in/out, consultar disponibilidad y movimientos). ` +
  `Usá ÚNICAMENTE estos datos reales (no inventes números):\n${JSON.stringify(kpis, null, 2)}\n\n` +
  `REGLA DE CONFIRMACIÓN: antes de cancelar una reserva, bloquear una habitación o cambiar precios, SIEMPRE pedí confirmación al gerente mostrando el preview, y solo llamá la tool con confirmed:true cuando él confirme explícitamente. ` +
  `Para crear reservas, check-in/out y consultas, ejecutá directamente. Si una acción falla, informalo y sugerí alternativas.`

/** Loop function-calling: el LLM decide tools, el backend las ejecuta, itera hasta respuesta final. */
export async function askGerente(
  query: string,
  kpis: Record<string, unknown>,
  hotelName: string,
  apiKey: string,
  repos: ToolRepos,
  hotelId: string,
): Promise<{ response: string; confidence: number; actions: { tool: string; result: any }[] }> {
  const actions: { tool: string; result: any }[] = []
  const messages: any[] = [
    { role: 'system', content: SYSTEM_BASE(hotelName, kpis) },
    { role: 'user', content: query },
  ]

  for (let i = 0; i < 4; i++) {
    const res = await callLlmRaw(messages, apiKey, MANAGER_TOOLS)
    if (!res.tool_calls || res.tool_calls.length === 0) {
      if (!res.content) break
      return { response: res.content, confidence: 0.9, actions }
    }
    messages.push({ role: 'assistant', content: res.content || '', tool_calls: res.tool_calls })
    for (const tc of res.tool_calls) {
      const rawArgs = tc.function?.arguments
      const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : (rawArgs || {})
      const result = await executeManagerTool(tc.function?.name, args, hotelId, repos).catch((e: any) => ({ error: String(e?.message || e) }))
      actions.push({ tool: tc.function?.name, result })
      messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) })
    }
  }
  // última pasada sin tools para forzar respuesta textual
  const final = await callLlmRaw(messages, apiKey)
  if (!apiKey) {
    return {
      response:
        `📊 ${hotelName} — ${kpis.fecha}\n` +
        `• Ocupación hoy: ${kpis.ocupacion_hoy}\n• Reservas totales: ${kpis.reservas_totales}\n` +
        `• Revenue del mes: $${kpis.revenue_mes}\n• Cancelaciones: ${kpis.cancelaciones}\n• ADR: $${kpis.adr}\n\n` +
        `_(LLM no configurado — tools administrativas requieren DEEPSEEK_API_KEY/LLM_API_KEY en .env)_`,
      confidence: 0.5,
      actions,
    }
  }
  return { response: final.content || '(no pude completar la acción — reformulá la consulta)', confidence: 0.6, actions }
}
