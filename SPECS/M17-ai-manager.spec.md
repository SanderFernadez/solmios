# SPEC — M17: Gerente Virtual con IA ⭐

**Suite**: Inteligencia Artificial
**Prioridad**: P1
**Complejidad**: Alta
**Destacado**: ★ Módulo estrella del sistema

---

## Descripción

Un briefing completo del hotel cada mañana, directo a WhatsApp del propietario/gerente. Analiza PMS, housekeeping, revenue, personal y genera recomendaciones inteligentes sin intervención humana.

---

## Funcionalidades

### 1. Reporte Diario Automatizado
- Se envía a las 8:00 AM (configurable)
- Formato: mensaje WhatsApp estructurado
- Datos: ocupación, llegadas, salidas, incidencias, ingresos
- Recomendaciones de IA basadas en datos

### 2. Métricas Incluidas
- Ocupación actual vs ayer vs misma fecha año anterior
- Llegadas y salidas del día
- Habitaciones pendientes de limpieza
- Incidencias abiertas
- Ingresos proyectados del día
- Comparativa semanal/mensual

### 3. Recomendaciones IA
- Ajuste de tarifas por demanda
- Alertas de occupancy baja
- Sugerencias de upselling
- Detección de patrones (estacionalidad, eventos)
- Predicción de ocupación próxima semana

### 4. Canales de Entrega
- WhatsApp (principal)
- Email con PDF adjunto
- Dashboard web
- Push notification en app

---

## Modelo de Datos

```typescript
interface DailyBriefing {
  id: UUID
  hotelId: UUID
  date: Date
  metrics: BriefingMetrics
  recommendations: Recommendation[]
  sentAt: Date
  channel: 'whatsapp' | 'email' | 'both'
}

interface BriefingMetrics {
  occupancy: {
    current: number       // percentage
    yesterday: number
    lastYear: number
    trend: 'up' | 'down' | 'stable'
  }
  arrivals: {
    today: number
    pending: number       // sin check-in
  }
  departures: {
    today: number
    pendingCheckout: number
  }
  housekeeping: {
    pending: number
    inProgress: number
    outOfService: number
  }
  incidents: {
    open: number
    critical: number
  }
  revenue: {
    today: number
    projected: number
    mtd: number           // month to date
    avgRate: number
    revpar: number
  }
}

interface Recommendation {
  id: UUID
  type: 'pricing' | 'operations' | 'marketing' | 'maintenance'
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  impact: string          // estimación de impacto
  action?: string         // acción sugerida
}
```

---

## Endpoints

```
GET    /ai-manager/briefings                        # Listar briefings
GET    /ai-manager/briefings/:date                  # Briefing de fecha específica
POST   /ai-manager/briefings/send                   # Enviar manualmente

GET    /ai-manager/config                           # Configuración del gerente virtual
PUT    /ai-manager/config                           # Actualizar configuración
PUT    /ai-manager/config/schedule                  # Cambiar horario de envío

GET    /ai-manager/analytics                        # Métricas de uso
GET    /ai-manager/analytics/recommendations         # Impacto de recomendaciones
```

---

## Generación del Briefing

```typescript
async function generateDailyBriefing(hotelId: string, date: Date) {
  // 1. Recopilar datos de múltiples módulos
  const occupancy = await getOccupancyMetrics(hotelId, date)
  const arrivals = await getArrivals(hotelId, date)
  const departures = await getDepartures(hotelId, date)
  const housekeeping = await getHousekeepingStatus(hotelId)
  const incidents = await getOpenIncidents(hotelId)
  const revenue = await getRevenueMetrics(hotelId, date)

  // 2. Análisis con IA
  const analysis = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Eres el gerente virtual del hotel ${hotel.name}. 
        Analiza los datos del día y genera un briefing ejecutivo.
        Sé conciso, directo y actionable. Máximo 5 recomendaciones.`
      },
      {
        role: 'user',
        content: `Datos del ${date}:\n${JSON.stringify({
          occupancy, arrivals, departures, housekeeping, incidents, revenue
        })}`
      }
    ]
  })

  // 3. Formatear para WhatsApp
  const message = formatWhatsAppBriefing(hotel, occupancy, arrivals, departures, 
    housekeeping, incidents, revenue, analysis.recommendations)

  // 4. Enviar
  await whatsapp.send(hotel.ownerPhone, message)

  // 5. Guardar en DB
  await saveBriefing(hotelId, date, metrics, recommendations)
}
```

---

## Formato del Mensaje WhatsApp

```
☀️ *Buenos días, {{ownerName}}*

📊 *Briefing Diario — {{hotelName}}*
📅 {{date}}

━━━━━━━━━━━━━━━━━━━━

🏨 *OCUPACIÓN*
• Actual: {{occupancy}}% ({{roomsOccupied}}/{{totalRooms}})
• Ayer: {{yesterday}}%
• {{trend}}

📋 *HOY*
• Llegadas: {{arrivals}} ({{pending}} pendientes)
• Salidas: {{departures}} ({{pendingCheckout}} por checkout)
• Hab. sucias: {{pendingClean}}

⚠️ *INCIDENCIAS*
• Abiertas: {{openIncidents}}
{{#if critical}}• 🔴 CRÍTICA: {{criticalDescription}}{{/if}}

💰 *INGRESOS*
• Hoy: ${{todayRevenue}}
• Proyectado: ${{projectedRevenue}}
• Promedio/noche: ${{avgRate}}
• RevPAR: ${{revpar}}

━━━━━━━━━━━━━━━━━━━━

💡 *RECOMENDACIONES IA*
{{#each recommendations}}
{{number}}. {{title}}
   {{description}}
{{/each}}

_Enviado automáticamente por SOLMI OS_
```

---

## Reglas de Negocio

1. El briefing se genera con datos frescos, no cacheados
2. Si hay incidencia crítica, aparece primero con alerta roja
3. Las recomendaciones se basan en datos reales, no suposiciones
4. Se puede pausar/enviar manualmente desde el dashboard
5. El propietario puede responder "detalles" para profundizar en un punto
6. Frecuencia configurable: diario, 2x/semana, semanal
7. Los datos comparativos usan misma fecha del año anterior cuando hay historial
