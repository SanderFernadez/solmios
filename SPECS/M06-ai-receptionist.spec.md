# SPEC — M06: Recepcionista Virtual con IA

**Suite**: Inteligencia Artificial
**Prioridad**: P1
**Complejidad**: Alta
**Integración**: OpenAI API + WhatsApp Business

---

## Descripción

Asistente virtual con IA que responde consultas de huéspedes 24/7 por WhatsApp, chat web, email y app. Cotiza, reserva, resuelve dudas y deriva a humano cuando es necesario.

---

## Funcionalidades

### 1. Canales de Atención
- WhatsApp Business API (principal)
- Chat web del hotel
- Email transaccional
- App SOLMI Guest

### 2. Capacidades
- Consulta de disponibilidad en tiempo real
- Cotización de tarifas por fechas
- Reserva directa desde el chat
- Upselling automático (upgrades, servicios)
- Preguntas frecuentes del hotel
- Derivación a recepcionista humano

### 3. Multi-idioma
- Español (nativo)
- Inglés
- Portugués
- Detección automática del idioma

### 4. Personalización
- Saludo personalizado con nombre del huésped
- Historial de conversaciones previas
- Preferencias del huésped (almohada, piso, vista)
- Respuestas customizadas por hotel

---

## Modelo de Datos

```typescript
interface ChatConversation {
  id: UUID
  hotelId: UUID
  guestId?: UUID
  channel: 'whatsapp' | 'web' | 'email' | 'app'
  guestPhone?: string
  guestEmail?: string
  status: 'active' | 'resolved' | 'transferred'
  language: 'es' | 'en' | 'pt'
  messages: ChatMessage[]
  createdAt: Date
  updatedAt: Date
}

interface ChatMessage {
  id: UUID
  conversationId: UUID
  role: 'guest' | 'assistant' | 'agent'
  content: string
  intent?: string         // booking, inquiry, complaint, etc.
  sentiment?: 'positive' | 'neutral' | 'negative'
  metadata: JSON
  createdAt: Date
}

interface AIConfig {
  hotelId: UUID
  welcomeMessage: string
  fallbackMessage: string
  transferThreshold: number  // 0-1, qué tan seguro debe estar antes de transferir
  enabledIntents: string[]
  customFAQs: FAQ[]
}

interface FAQ {
  question: string
  answer: string
  keywords: string[]
}
```

---

## Endpoints

```
GET    /ai-chat/conversations                   # Listar conversaciones
GET    /ai-chat/conversations/:id               # Detalle con mensajes
POST   /ai-chat/conversations/:id/transfer      # Transferir a humano

POST   /ai-chat/config                          # Configurar IA del hotel
GET    /ai-chat/config                          # Obtener configuración

GET    /ai-chat/analytics                       # Métricas de uso
GET    /ai-chat/analytics/intents               # Distribución de intenciones
GET    /ai-chat/analytics/satisfaction           # Satisfacción

POST   /webhooks/whatsapp                       # Webhook WhatsApp
POST   /webhooks/chat-web                       # Webhook chat web
```

---

## Flujo de Conversación

```
Huésped escribe → WhatsApp/Chat/Web
        ↓
  Parser de idioma
        ↓
  Detección de intención (intent classification)
        ↓
  ┌─────────────────┬──────────────────┬─────────────────┐
  │   Disponibilidad │     Reserva      │   Pregunta FAQ   │
  │   → Consulta DB  │  → Flujo reserva │  → Busca en FAQ  │
  │                  │                  │                  │
  └────────┬────────┴────────┬─────────┴────────┬────────┘
           ↓                 ↓                  ↓
     Respuesta IA      Respuesta IA       Respuesta IA
           ↓                 ↓                  ↓
  ¿Confianza < 70%?   ¿Completa?        ¿Encontrada?
        ↓ SI              ↓ NO               ↓ NO
  Transferir a        Guiar para         Derivar a
  humano              completar          humano
```

---

## Integración OpenAI

```typescript
const systemPrompt = `
Eres el asistente virtual del hotel ${hotel.name}.
Responde en ${guest.language || 'español'}.
Tu objetivo es ayudar con disponibilidad, tarifas y reservas.
${hotel.aiConfig.customInstructions}

Disponibilidad actual: ${availability_summary}
Tarifas de hoy: ${rates_summary}
`

const response = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: guestMessage },
  ],
  tools: [
    {
      type: 'function',
      function: {
        name: 'check_availability',
        description: 'Verificar disponibilidad de habitaciones',
        parameters: {
          checkIn: 'string (YYYY-MM-DD)',
          checkOut: 'string (YYYY-MM-DD)',
          roomType: 'string (optional)',
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'create_reservation',
        description: 'Crear una reserva',
        parameters: {
          checkIn: 'string',
          checkOut: 'string',
          roomTypeId: 'string',
          guestName: 'string',
          guestPhone: 'string',
        },
      },
    },
  ],
})
```

---

## Reglas de Negocio

1. El chatbot NUNCA inventa precios — siempre consulta la DB
2. Si el huésped expresa frustración (> 2 mensajes negativos), transferir a humano
3. Las reservas creadas por IA quedan en estado `pending` para confirmación
4. El chatbot guarda todo el historial para análisis de mejora
5. Horario de atención humana: configurable por hotel
6. Fuera de horario, el chatbot responde y ofrece dejar mensaje
7. Idioma detectado se mantiene durante toda la conversación
