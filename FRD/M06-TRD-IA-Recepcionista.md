# TRD · M06 — Recepcionista Virtual con IA

> **Technical Requirements Document** — Diseño completo del módulo AI Receptionist para ManagerHotel.
> Basado en: `FRD/M06-IA-Recepcionista.md`, `PRD.md` Suite 3, `ARCHITECTURE.md`, arckode-framework.

**Fecha:** 2026-06-23
**Estado:** Spec listo para implementación
**Estimación:** 6-8 semanas (1 dev full-time + 1 AI/LLM specialist)
**Módulo backend:** `ai-recepcionista` (nuevo, 7 tablas)
**Módulo frontend:** `pages/ai-receptionist/` (4 vistas)

---

## 1. Resumen Ejecutivo

M06 — Recepcionista Virtual con IA es el módulo de atención al huésped multicanal con inteligencia artificial. Opera como una recepcionista senior, agente de ventas, concierge y soporte.

**Stack IA:** Arckode Framework NLP Engine (rule-based para intents comunes) + LLM externo (Z.AI GLM / OpenAI) como fallback y generación de respuestas naturales.

**Canales:** WhatsApp Business API, Web Chat (widget), Email, Voice (OpenAI Realtime SIP o Retell AI), Mobile App (futuro).

**Objetivos KPIs:**
- Resolución por bot > 70%
- Tiempo promedio respuesta < 2s
- Satisfacción huésped > 4.0/5
- Tasa de escalamiento < 30%
- Incremento upsells > 15%

---

## 2. Tabla de Decisiones Técnicas (Arquitectura)

### 2.1 Motor de IA

| Decisión | Opción A | Opción B | Opción C | **Recomendada** | Justificación |
|----------|----------|----------|----------|-----------------|---------------|
| **Modelo NLP (detección de intents)** | Reglas + fuzzy matching local | Embeddings + cosine similarity | LLM directo para todo | **A (reglas + fuzzy)** | Rápido (< 50ms), sin costo por mensaje, funciona offline. El LLM solo se invoca cuando confianza < umbral. |
| **LLM para generación de respuestas** | Z.AI GLM-5.2 | **Qwen3-14B via Ollama (local, Apache 2.0)** | OpenAI GPT-4o | **B (Qwen3 — open source)** | Qwen3 tiene el mejor español entre open source (Apache 2.0). Corre en Ollama sin costos de API. Si no hay GPU disponible, Z.AI GLM como fallback cloud. DeepSeek V3 también viable (MIT). |
| **Framework de chatbot** | Implementación propia | Rasa Open Source | Botpress / Voiceflow | **A (propia)** | Control total sobre el flujo. Integración directa con PMS. Sin dependencia de SaaS externo. |
| **Detección de idioma** | Librería `franc-min` | LLM detect | Config manual por hotel | **A (franc-min)** | Ligero, rápido, preciso para es/en/pt. Sin llamada a API. |
| **Variables dinámicas en respuestas** | Template strings (`{guestName}`) | LLM fill-in | Handlebars templates | **A (template strings)** | Simple, determinista, sin alucinaciones para datos del PMS. |

### 2.2 Canal WhatsApp

| Decisión | Opción A | Opción B | **Recomendada** | Justificación |
|----------|----------|----------|-----------------|---------------|
| **SDK WhatsApp** | Baileys (WebSocket no oficial) | WhatsApp Business API (Meta) | **B (Meta Cloud API)** | Oficial, production-grade, sin riesgo de ban. Ya se exploró Baileys en otro proyecto. |
| **Webhook verificación** | HMAC-SHA256 (Meta estándar) | Token query param | **A (HMAC)** | Estándar de Meta. Más seguro. |
| **Múltiples números por tenant** | Un número por hotel | Un número plataforma | **A (por hotel)** | Cada hotel tiene su marca. Número dedicado = profesionalismo. |
| **Rate limiting mensajes** | Por hotel (Meta impone 250 msg/s) | Cola interna + throttle | **A (Meta limits)** | Respetar límites de Meta evita bans. |

### 2.3 Persistencia e Integración

| Decisión | Opción A | Opción B | **Recomendada** | Justificación |
|----------|----------|----------|-----------------|---------------|
| **Almacenar mensajes** | Tabla `ai_messages` (propia) | Reusar `message_logs` existente | **A (ai_messages)** | Estructura diferente (intent, confidence, contentType). Separación clara. |
| **Config WhatsApp** | Tabla `ai_whatsapp_config` (propia) | Tabla `configuration` KV | **A (propia)** | Datos sensibles (tokens). Schema tipado. Validación a nivel DB. |
| **Integración con módulos PMS** | Conectores (socket-based) | Llamadas directas vía `resolveModule` | **A (conectores)** | Regla del proyecto: no importar módulos directamente. |
| **Cache de respuestas frecuentes** | MemoryCache del framework | Redis (no existe) | **A (MemoryCache)** | Ya existe en el framework. TTL 300s para FAQs. |
| **Métricas** | Agregación nocturna (night audit) | Real-time (cada mensaje) | **A (nocturna)** | Evita writes en el hot path del chat. Consistente con el night audit existente. |
| **Audio/Voice calls** | No implementar en MVP | OpenAI Realtime SIP | **LiveKit Agents + Qwen3 + CosyVoice 3.0 (100% open source)** | **B (LiveKit Agents — open source)** | LiveKit Agents (Apache 2.0, 11k stars) + SIP gateway → Qwen3-14B (Apache 2.0, mejor español) + CosyVoice 3.0 (Apache 2.0, 150ms TTS) + faster-whisper (STT). Stack 100% open source, sin vendor lock-in, sin costos recurrentes de API. Requiere GPU (RTX 4090 ~$250/mes o compartida). 1000 llamadas/mes ≈ $310-480/mes total. Alternativa rápida: OpenAI Realtime SIP a ~$290/mes sin GPU. |

### 2.4 Canal Voice (Llamadas Telefónicas con IA)

En 2026 hay tres rutas para atender llamadas con IA. La Ruta 0 es la más barata posible — casi gratis.

---

#### Ruta 0 — Low Cost: whisper.cpp + DeepSeek API + Edge TTS (~$6.50/mes total)

**La más barata. Voz NATURAL (neural). Sin GPU. Todo en el mismo servidor.**

```
Huésped llama al número del hotel
        │
        ▼
   Twilio ($1/mes número + $0.013/min)
        │
        ▼ Media Streams (WebSocket, audio 8kHz)
        │
   ┌──────────────────────────────────────────────┐
   │        Tu servidor Bun (mismo backend)        │
   │                                               │
   │  1. Recibe audio chunks del WebSocket         │
   │  2. Guarda en buffer de 2 segundos            │
   │  3. whisper.cpp (STT) → texto                 │
   │     Modelo: whisper-large-v3, CPU, ~500ms     │
   │  4. DeepSeek API (LLM) → respuesta texto      │
   │     ~$0.016 por llamada de 3 min              │
   │  5. Edge TTS (Microsoft) → audio NATURAL      │
   │     Voz: es-MX-DaliaNeural (mujer, cálida)    │
   │     Voz: es-ES-ElviraNeural (mujer, formal)   │
   │     Voz: es-MX-JorgeNeural (hombre)           │
   │     GRATIS, sin API key, ~200ms, CPU          │
   │  6. Audio → WebSocket → Twilio → huésped      │
   └──────────────────────────────────────────────┘
```

**Costo mensual real (100 llamadas de 3 min):**

| Concepto | Costo |
|----------|-------|
| Número Twilio | $1.00 |
| Minutos entrantes (300 min) | $3.90 |
| DeepSeek API (~$0.016/llamada) | $1.60 |
| whisper.cpp (STT) | **$0** |
| Edge TTS (voz neural) | **$0** |
| Servidor | **$0** (mismo backend) |
| **Total** | **~$6.50/mes** |

**1000 llamadas/mes → ~$25/mes.**

**Instalación (30 minutos):**
```bash
# STT — whisper.cpp (gratis, CPU)
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp && make
bash models/download-ggml-model.sh large-v3

# TTS — Edge TTS (gratis, voces neurales de Microsoft, CPU)
pip install edge-tts
# Probar:
edge-tts --voice es-MX-DaliaNeural --text "Buenos días, ¿en qué puedo ayudarle?" --write-media saludo.mp3

# Voces español disponibles:
edge-tts --list-voices | grep es-
# es-MX-DaliaNeural    → Mexicana, cálida (recomendada para hotel)
# es-ES-ElviraNeural   → Española, formal
# es-MX-JorgeNeural    → Mexicano, masculino
# es-AR-ElenaNeural    → Argentina
# es-CO-SalomeNeural   → Colombiana
# es-US-PalomaNeural   → Latina US
```

**¿Por qué Edge TTS suena natural y Piper no?**

Piper usa síntesis paramétrica (formantes). Edge TTS usa redes neuronales (VITS + HiFi-GAN). La diferencia es como un GPS de 2005 vs una persona real. Edge TTS tiene entonación, pausas naturales, y respiración. Y es gratis — Microsoft lo ofrece sin API key porque es el motor que usan en Azure Cognitive Services; el paquete `edge-tts` hace de puente.

**Limitación real:** Es un área gris de los ToS de Microsoft (no es una API oficial). Para producción, si querés compliance total, ElevenLabs cuesta ~$0.015/llamada extra. Pero con Edge TTS arrancás hoy con voz natural a costo cero.

---

#### Ruta 1 — OpenAI Realtime SIP (rápida, sin GPU, ~$290/mes)

OpenAI maneja TODO el pipeline de voz. Setup en 15 minutos:

```
Hotel recibe llamada → Twilio SIP trunk → sip://proj_xxx@sip.api.openai.com → GPT-4o Realtime
                                                                               │
                                                     ┌─────────────────────────┘
                                                     ▼
                                          OpenAI: STT + LLM + function calling + TTS
                                          Tools → tu backend PMS (search_rooms, create_booking...)
                                          Audio vuelve al huésped
```

**Setup:** 1) Número Twilio ($1/mes) → 2) Elastic SIP Trunk → 3) Webhook → 4) Prompt + tools.
**Costo:** ~$0.29/llamada de 3 min, ~$290/mes para 1000 llamadas.
**Contra:** Vendor lock-in OpenAI. Solo voces predefinidas de OpenAI.

---

#### Ruta 2 — LiveKit Agents + Qwen3 + CosyVoice 3.0 (open source, sin vendor lock-in, ~$350-480/mes con GPU)

Stack 100% open source, todos Apache 2.0. La más alineada con la filosofía del proyecto:

```
Hotel recibe llamada → Twilio → LiveKit SIP Gateway (Apache 2.0)
                                      │
                        LiveKit Agents Server (orquestación de audio)
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          ▼                           ▼                           ▼
   STT: faster-whisper         LLM: Qwen3-14B              TTS: CosyVoice 3.0
   (Whisper large-v3)          (Ollama, Apache 2.0)        (Apache 2.0, 150ms)
   español excelente           mejor español OS             voz natural español
```

**Componentes:**
| Capa | Tecnología | Licencia | Por qué |
|------|-----------|----------|---------|
| Orquestación | **LiveKit Agents** | Apache 2.0 | 11k stars, SIP gateway nativo, VAD, turn detection, function calling, plugins |
| STT | **faster-whisper** (large-v3) | MIT | 4x más rápido que OpenAI Whisper, español excelente |
| LLM | **Qwen3-14B** (Ollama) | Apache 2.0 | Mejor español entre open source, 14B cabe en 1 GPU |
| TTS | **CosyVoice 3.0** | Apache 2.0 | 150ms streaming, español natural, voice cloning |
| Telefonía | **LiveKit SIP** | Apache 2.0 | Incluido en LiveKit, conecta con Twilio/Plivo |

**Costo mensual (1000 llamadas):**
| Recurso | Costo |
|---------|-------|
| GPU RTX 4090 (RunPod) | ~$250-400 |
| Servidor orquestación (4 vCPU) | ~$20-40 |
| Twilio número + minutos | ~$40 |
| **Total** | **~$310-480/mes** |

**Alternativa híbrida (calidad máxima sin GPU):**
LiveKit + Deepgram STP + Qwen3-235B API + ElevenLabs TTS ≈ $200-300/mes. Mejor calidad que OpenAI, sin GPU.

**Ventajas sobre OpenAI:**
- Zero vendor lock-in. Cambias cualquier componente cuando quieras.
- Modelos Apache 2.0 — zero riesgo legal.
- Qwen3 supera a GPT-4o en benchmarks de español.
- CosyVoice 3.0 permite clonar la voz de la marca del hotel.
- El stack es el mismo para chat de texto (Qwen3 ya corre en Ollama).

---

#### Ruta 3 — Retell AI / Bland.ai (no-code, external)

Plataformas SaaS que manejan todo. Solo configuras prompt + webhooks al PMS.

**Costo:** ~$0.11/min all-in.
**Cuándo:** Si no querés mantener GPU ni servidor. La más cara a escala pero cero mantenimiento.

---

#### Decisión: Ruta 0 (Low Cost) para arrancar hoy, Ruta 2 (LiveKit open source) a futuro

La Ruta 0 cuesta **$6.50/mes** y usa el mismo servidor Bun del backend. Cero GPU, cero infraestructura nueva. Si algún día necesitás mejor calidad de voz, migrás Piper → CosyVoice 3.0 o ElevenLabs sin cambiar nada más del pipeline.

**Tabla de voice config por hotel:**

```
orm.define('AiVoiceConfig', {
  table: 'ai_voice_config',
  timestamps: true,
  fields: {
    id:              { type: 'string', required: true },
    hotelId:         { type: 'string', required: true, unique: true },
    provider:        { type: 'string', default: 'lowcost' },   // 'lowcost' | 'livekit' | 'openai' | 'retell'
    phoneNumber:     { type: 'string' },                       // Número Twilio asignado
    sipEndpoint:     { type: 'string' },                       // sip://livekit-sip:5060 o sip://proj@sip.api.openai.com
    voiceId:         { type: 'string', default: 'cosyvoice_es_female_1' }, // Voz del bot
    welcomeMessage:  { type: 'text' },                         // Mensaje inicial al contestar
    transferNumber:  { type: 'string' },                       // Número humano para transferir
    maxCallDuration: { type: 'number', default: 600 },         // 10 min máximo
    isActive:        { type: 'number', default: 0 },
    sttModel:        { type: 'string', default: 'whisper-large-v3' },  // 'whisper' | 'deepgram'
    llmModel:        { type: 'string', default: 'qwen3:14b' },         // Modelo en Ollama o API
    ttsModel:        { type: 'string', default: 'edge-tts-es-MX-Dalia' }, // 'edge-tts' | 'elevenlabs' | 'cosyvoice'
    openaiApiKey:    { type: 'string' },                       // Solo si provider=openai (encriptado)
    livekitUrl:      { type: 'string' },                       // Solo si provider=livekit
    livekitApiKey:   { type: 'string' },                       // Solo si provider=livekit (encriptado)
  },
})
```

---

## 3. Modelo de Datos (Backend — 7 tablas)

> **Todas las tablas y columnas en INGLÉS** (regla del proyecto).
> Multi-tenant por columna `hotelId`. id = TEXT (UUID). Timestamps: `createdAt`/`updatedAt`.

### 3.1 `ai_conversations` — Conversaciones activas e históricas

```
orm.define('AiConversations', {
  table: 'ai_conversations',
  timestamps: true,
  fields: {
    id:              { type: 'string', required: true },
    hotelId:         { type: 'string', required: true, indexed: true },
    guestId:         { type: 'string' },                    // FK guests.id (nullable: walk-in)
    reservationId:   { type: 'string' },                    // FK reservations.id
    channel:         { type: 'string', required: true },    // 'whatsapp' | 'webchat' | 'email' | 'voice' | 'app_guest'
    channelConversationId: { type: 'string', indexed: true }, // WhatsApp phone ID or webchat session
    guestPhone:      { type: 'string' },                    // Útil para WhatsApp sin guestId
    guestName:       { type: 'string' },                    // Display name
    language:        { type: 'string', default: 'es' },     // 'es' | 'en' | 'pt'
    status:          { type: 'string', default: 'active' }, // 'active' | 'resolved' | 'transferred' | 'waiting'
    resolvedBy:      { type: 'string' },                    // 'bot' | 'agent' | 'hybrid' | null
    assignedAgentId: { type: 'string' },                    // FK users.id
    satisfactionScore: { type: 'number' },                  // 1-5
    startedAt:       { type: 'string', required: true },
    endedAt:         { type: 'string' },
    lastMessageAt:   { type: 'string' },
    intentSummary:   { type: 'string' },                    // Última intención detectada
    tags:            { type: 'json', default: [] },         // ['booking', 'complaint', 'faq']
  },
})
```

### 3.2 `ai_messages` — Mensajes individuales

```
orm.define('AiMessages', {
  table: 'ai_messages',
  timestamps: true,
  fields: {
    id:               { type: 'string', required: true },
    conversationId:   { type: 'string', required: true, indexed: true },
    hotelId:          { type: 'string', required: true, indexed: true },
    sender:           { type: 'string', required: true },    // 'guest' | 'bot' | 'agent' | 'system'
    content:          { type: 'text', required: true },
    contentType:      { type: 'string', default: 'text' },   // 'text' | 'image' | 'document' | 'location' | 'template' | 'button' | 'interactive'
    mediaUrl:         { type: 'string' },                    // URL de imagen/documento
    intentDetected:   { type: 'string' },                    // Nombre de la intención NLP
    confidence:       { type: 'number' },                    // 0-1 score del NLP
    actionTaken:      { type: 'string' },                    // 'booking_created' | 'payment_sent' | 'incident_registered' | null
    actionResult:     { type: 'json' },                      // Resultado de la acción (ej: { reservationId: '...' })
    metadata:         { type: 'json' },                      // WhatsApp msg id, webchat session, etc.
  },
})
```

### 3.3 `ai_intents` — Intenciones entrenadas

```
orm.define('AiIntents', {
  table: 'ai_intents',
  timestamps: true,
  fields: {
    id:                { type: 'string', required: true },
    hotelId:           { type: 'string', required: true, indexed: true },
    name:              { type: 'string', required: true },      // 'consultar_disponibilidad'
    category:          { type: 'string', default: 'general' },  // 'booking' | 'faq' | 'service' | 'complaint' | 'payment' | 'concierge' | 'emergency'
    triggerPhrases:    { type: 'json', required: true },        // ['hay habitación', 'tienen disponibilidad', 'quiero reservar']
    responseTemplate:  { type: 'text', required: true },        // 'Tenemos {count} habitaciones {type} disponibles...'
    action:            { type: 'string' },                      // 'search_rooms' | 'create_booking' | 'check_availability' | 'send_invoice' | 'register_incident' | null
    actionPayload:     { type: 'json' },                        // Parámetros para la acción
    fallbackResponse:  { type: 'text' },                        // Si confianza < umbral pero es la mejor match
    priority:          { type: 'number', default: 0 },          // Desempate (mayor = más prioridad)
    confidenceThreshold: { type: 'number', default: 0.65 },    // Umbral mínimo para esta intent
    requiresAuth:      { type: 'number', default: 0 },          // 1 = necesita guestId/reservationId
    isSystem:          { type: 'number', default: 0 },          // 1 = no se puede eliminar
    isActive:          { type: 'number', default: 1 },
  },
})
```

### 3.4 `ai_templates` — Plantillas de respuesta rápida

```
orm.define('AiTemplates', {
  table: 'ai_templates',
  timestamps: true,
  fields: {
    id:          { type: 'string', required: true },
    hotelId:     { type: 'string', required: true, indexed: true },
    name:        { type: 'string', required: true },         // 'bienvenida', 'fuera_horario', 'checkout_recordatorio'
    category:    { type: 'string', required: true },         // 'greeting' | 'faq' | 'service' | 'complaint' | 'checkout' | 'emergency' | 'upsell'
    trigger:     { type: 'string' },                         // Palabra clave o evento
    responseEs:  { type: 'text', required: true },           // Respuesta en español
    responseEn:  { type: 'text' },                           // Respuesta en inglés
    responsePt:  { type: 'text' },                           // Respuesta en portugués
    channel:     { type: 'string', default: 'all' },         // 'all' | 'whatsapp' | 'email' | 'webchat'
    variables:   { type: 'json', default: [] },              // ['guestName', 'hotelName', 'checkInDate']
    buttons:     { type: 'json' },                           // Botones interactivos (WhatsApp)
    isSystem:    { type: 'number', default: 0 },
    isActive:    { type: 'number', default: 1 },
  },
})
```

### 3.5 `ai_whatsapp_config` — Configuración WhatsApp por hotel

```
orm.define('AiWhatsappConfig', {
  table: 'ai_whatsapp_config',
  timestamps: true,
  fields: {
    id:                  { type: 'string', required: true },
    hotelId:             { type: 'string', required: true, unique: true },
    phoneNumberId:       { type: 'string', required: true },     // WhatsApp Business phone number ID
    wabaId:              { type: 'string' },                     // WhatsApp Business Account ID
    accessToken:         { type: 'string', required: true },     // Token permanente (encriptado)
    verifyToken:         { type: 'string', required: true },     // Token verificación webhook
    webhookUrl:          { type: 'string' },                     // Computado: {base}/api/ai/whatsapp/webhook/{hotelId}
    isActive:            { type: 'number', default: 0 },
    businessHoursStart:  { type: 'string', default: '08:00' },   // HH:mm
    businessHoursEnd:    { type: 'string', default: '22:00' },   // HH:mm
    businessDays:        { type: 'json', default: [1,2,3,4,5,6,7] }, // 1=Lun..7=Dom
    outsideHoursMessage: { type: 'text' },
    autoReplyDelay:      { type: 'number', default: 1000 },      // ms de delay para simular "escribiendo..."
    maxAutoRetries:      { type: 'number', default: 3 },         // Intentos antes de escalar
    transferAgentPhone:  { type: 'string' },
    dailyMessageLimit:   { type: 'number', default: 1000 },
  },
})
```

### 3.6 `ai_metrics_daily` — Métricas agregadas por día

```
orm.define('AiMetricsDaily', {
  table: 'ai_metrics_daily',
  timestamps: false,
  fields: {
    id:                   { type: 'string', required: true },
    hotelId:              { type: 'string', required: true, indexed: true },
    date:                 { type: 'string', required: true },     // YYYY-MM-DD
    totalConversations:   { type: 'number', default: 0 },
    totalMessages:        { type: 'number', default: 0 },
    botResolved:          { type: 'number', default: 0 },
    hybridResolved:       { type: 'number', default: 0 },
    agentResolved:        { type: 'number', default: 0 },
    escalatedToHuman:     { type: 'number', default: 0 },
    avgConfidence:        { type: 'number', default: 0 },
    avgResponseTimeMs:    { type: 'number', default: 0 },
    avgSatisfaction:      { type: 'number', default: 0 },
    topIntents:           { type: 'json' },                       // Top 10 intenciones [{name, count}]
    topCategories:        { type: 'json' },                       // Top categorías
    messagesByChannel:    { type: 'json' },                       // {whatsapp: 42, webchat: 8}
    bookingsGenerated:    { type: 'number', default: 0 },
    upsellsAccepted:      { type: 'number', default: 0 },
    complaintsResolved:   { type: 'number', default: 0 },
  },
})
```

### 3.7 `ai_booking_flow` — Estado del flujo de reserva por conversación

```
orm.define('AiBookingFlows', {
  table: 'ai_booking_flows',
  timestamps: true,
  fields: {
    id:              { type: 'string', required: true },
    conversationId:  { type: 'string', required: true, indexed: true },
    hotelId:         { type: 'string', required: true, indexed: true },
    step:            { type: 'string', default: 'init' },         // 'init' | 'dates' | 'guests' | 'room_select' | 'confirm' | 'guest_info' | 'payment' | 'done'
    checkIn:         { type: 'string' },
    checkOut:        { type: 'string' },
    adults:          { type: 'number', default: 1 },
    children:        { type: 'number', default: 0 },
    preferredRoomType: { type: 'string' },
    selectedRoomId:  { type: 'string' },
    selectedRoomType: { type: 'string' },
    totalAmount:     { type: 'number', default: 0 },
    currency:        { type: 'string', default: 'USD' },
    guestName:       { type: 'string' },
    guestEmail:      { type: 'string' },
    guestPhone:      { type: 'string' },
    reservationId:   { type: 'string' },                          // FK una vez creada
    paymentLinkId:   { type: 'string' },
    paymentStatus:   { type: 'string', default: 'pending' },      // 'pending' | 'sent' | 'paid' | 'expired'
    upsellsOffered:  { type: 'json' },                            // [{type, name, price, accepted}]
    completedAt:     { type: 'string' },
  },
})
```

---

## 4. Tabla de Decisiones — Operaciones del Bot

### 4.1 Booking Flow (Reserva paso a paso)

Esta es la decisión más compleja del sistema. El bot guía al huésped por un flow de 7 pasos.

| Paso | Trigger | Condición | Acción del Bot | Validación | Error / Retry |
|------|---------|-----------|----------------|------------|---------------|
| **1. Init** | Huésped: "quiero reservar", "hay habitación", "disponibilidad" | Intención `booking_request` detectada | Crea `AiBookingFlows` (step=init). Pregunta: "¿Qué fechas te interesan? (ej: 15 Jul → 18 Jul)" | — | Si ya existe flow activo → "Ya tienes una reserva en proceso. ¿Continuamos?" |
| **2. Dates** | Huésped envía fechas | NLP extrae `checkIn` y `checkOut` con date-parser | Valida fechas. Pregunta: "¿Cuántos adultos y niños?" | checkIn >= hoy, checkOut > checkIn, estancia ≤ 30 noches | Si fechas inválidas → "No entendí las fechas. Ejemplo: 15 de julio al 18 de julio" |
| **3. Guests** | Huésped envía ocupación | NLP extrae números | Llama `search_availability(checkIn, checkOut, adults)`. Presenta opciones. | adults ≥ 1, adults ≤ capacidad máxima | Sin disponibilidad → "No hay habitaciones en esas fechas. ¿Te sirven fechas cercanas? Tengo: ..." |
| **4. Room Select** | Huésped elige tipo de room | Coincide con un roomType disponible | Muestra precio total, amenities, fotos. Ofrece upsells (desayuno, traslado, late checkout). | Room válida y disponible | Si ambigüedad → "Tengo Deluxe ($120/noche) y Suite ($200/noche). ¿Cuál prefieres?" |
| **5. Confirm** | Huésped: "sí", "reservo", "confirmar" | step = room_select | Resume booking. Pide datos de contacto. | — | Si duda → "¿Te gustaría que te explique algo más sobre la habitación?" |
| **6. Guest Info** | Huésped envía nombre/email/teléfono | NLP extrae campos | Crea `Guest` + `Reservation` (status=pending). Genera payment link. | email válido, nombre presente | Email inválido → "Ese email no parece correcto. ¿Me lo confirmas?" |
| **7. Payment → Done** | Huésped completa pago | Webhook Stripe confirma pago | Actualiza reservation status = confirmed. Envía confirmación. | Pago recibido | Pago pendiente después de 1h → recordatorio: "Tu reserva expira en 2 horas. ¿Necesitas ayuda con el pago?" |

### 4.2 Intents pre-entrenados (sistema — 25 intenciones base)

| # | Intent Name | Category | Trigger Examples | Action | Response Template |
|---|-------------|----------|------------------|--------|-------------------|
| 1 | `greeting` | general | "hola", "buenos días", "hey" | — | "¡Bienvenido/a a {hotelName}! Soy {botName}, tu recepcionista virtual. ¿En qué puedo ayudarte?" |
| 2 | `booking_request` | booking | "reservar", "quiero una habitación", "disponibilidad" | start_booking_flow | "¡Claro! Busquemos la habitación perfecta. ¿Qué fechas te interesan?" |
| 3 | `check_availability` | booking | "hay habitación el 20", "disponible mañana", "tienen algo para" | search_rooms | Muestra rooms disponibles con precios |
| 4 | `modify_booking` | booking | "cambiar reserva", "modificar fecha", "extender estancia" | lookup_reservation → modify | "Déjame buscar tu reserva. ¿Me das tu número de confirmación o email?" |
| 5 | `cancel_booking` | booking | "cancelar", "no voy a poder ir", "anular reserva" | lookup_reservation → cancel | Confirma antes de cancelar. Muestra política. |
| 6 | `checkin_info` | faq | "check-in", "a qué hora se entra", "hora de llegada" | — | "El check-in es a las {checkInTime}. Si llegas antes, podemos guardar tu equipaje." |
| 7 | `checkout_info` | faq | "check-out", "hora de salida", "hasta que hora" | — | "El check-out es a las {checkOutTime}. ¿Te gustaría late checkout por ${price} extra?" |
| 8 | `wifi_info` | faq | "wifi", "clave internet", "contraseña wifi" | — | "Red: {wifiNetwork} / Contraseña: {wifiPassword}" |
| 9 | `parking_info` | faq | "parqueo", "estacionamiento", "dónde aparcar" | — | "Tenemos parking {type}. {details}" |
| 10 | `breakfast_info` | faq | "desayuno", "a qué hora es el desayuno", "incluye desayuno" | — | Info sobre desayuno + upsell: "¿Te gustaría agregar desayuno por ${price}/persona?" |
| 11 | `pool_info` | faq | "piscina", "alberca", "horario piscina" | — | Info de amenities del hotel |
| 12 | `restaurant_info` | faq | "restaurante", "comida", "room service" | — | Info de restaurante + menú |
| 13 | `transport_info` | concierge | "transporte", "aeropuerto", "taxi", "cómo llegar" | — | Info + upsell: "Ofrecemos traslado al aeropuerto por ${price}" |
| 14 | `tourist_info` | concierge | "qué visitar", "lugares cerca", "playa", "excursión" | — | Recomendaciones locales configurables por hotel |
| 15 | `payment_request` | payment | "pagar", "cuánto debo", "factura", "invoice" | send_payment_link | Busca reserva → genera link de pago |
| 16 | `payment_status` | payment | "ya pagué", "confirmar pago", "recibieron el pago" | check_payment_status | Confirma estado de pago |
| 17 | `complaint_room` | complaint | "no funciona", "roto", "sucio", "huele mal", "ruido" | register_incident | "Lamento el inconveniente. Déjame registrarlo para resolverlo cuanto antes." |
| 18 | `complaint_service` | complaint | "mala atención", "no me trajeron", "demoraron" | register_incident | Escala a manager si severidad alta |
| 19 | `housekeeping_request` | service | "limpieza", "toallas", "jabón", "papel higiénico", "sábanas" | create_housekeeping_task | Crea tarea en M07 Housekeeping |
| 20 | `maintenance_request` | service | "aire acondicionado", "ducha fría", "luz no funciona" | create_maintenance_ticket | Crea ticket en M08 Mantenimiento |
| 21 | `spa_request` | service | "spa", "masaje", "reservar spa" | — | Info + upsell: "Tenemos masajes desde ${price}" |
| 22 | `late_checkout_request` | service | "tarde", "quedarme más", "salir después" | offer_late_checkout | "Late checkout hasta las {time} por ${price}" |
| 23 | `emergency` | emergency | "emergencia", "doctor", "ambulancia", "policía", "incendio" | escalate_to_human URGENT | "Emergencia detectada. Un momento, te contactamos inmediatamente." |
| 24 | `human_agent` | general | "humano", "persona real", "recepcionista", "gerente" | escalate_to_human | "Claro, te transfiero con un agente. Un momento por favor." |
| 25 | `gratitude` | general | "gracias", "perfecto", "excelente", "adiós" | solicitar_satisfaccion | "¡Gracias a ti! ¿Cómo calificarías esta atención? 1⭐ a 5⭐" |

### 4.3 Decision Table — Recepción de Mensaje (Core Loop)

| Step | Condición | Acción | Timeout |
|------|-----------|--------|---------|
| 1. Recibir mensaje | Webhook WhatsApp / POST chat | Validar HMAC firma. Extraer `hotelId`, `sender`, `content`. | < 100ms |
| 2. Buscar conversación activa | `channelConversationId` + `status=active` | Si existe → añadir mensaje. Si no → crear `ai_conversations`. | — |
| 3. Detectar idioma | Primer mensaje de conversación | `franc-min` detect. Guardar en `conversation.language`. | < 20ms |
| 4. Detectar intención | `content` + `triggerPhrases` de `ai_intents` activas del hotel | Calcular score fuzzy. Si score > threshold → intent match. Si no → LLM classify. | < 200ms (fuzzy) / < 2s (LLM) |
| 5. Evaluar acción | `intent.action` != null | Ejecutar acción asociada (search_rooms, create_booking, register_incident...). Guardar resultado en `message.actionTaken`. | Variable |
| 6. Generar respuesta | `intent.responseTemplate` + variables | Rellenar `{variables}` con datos reales del PMS. Si template vacío → LLM genera respuesta. | < 100ms (template) / < 2s (LLM) |
| 7. Enviar respuesta | Canal correspondiente | WhatsApp: POST Meta API. Webchat: WebSocket emit. Email: SMTP. | < 500ms |
| 8. Registrar métrica | Always | Incrementar contadores en `ai_metrics_daily` (real-time o batch nocturno). | Async |

### 4.4 Decision Table — Escalamiento a Humano

| Condición | Severidad | Acción | Notificación |
|-----------|-----------|--------|--------------|
| Intención `emergency` detectada | CRÍTICA | Marcar conversación `transferred`. POST al webhook de emergencia. | F5 urgente a todos los agentes: "🚨 EMERGENCIA: {guestName}" |
| Intención `human_agent` explícita | ALTA | Marcar `transferred`. Si agente disponible → asignar. Si no → `waiting` + mensaje espera. | F5 a agentes: "{guestName} solicita agente humano" |
| 3 intentos fallidos del bot (misma conversación) | MEDIA | Marcar `transferred`. Añadir resumen de intents fallidos. | F5: "Bot no pudo resolver. {guestName} necesita asesor" |
| Satisfacción ≤ 2 estrellas | MEDIA | Alertar al admin. No requiere acción inmediata. | F5: "{guestName} calificó {score}⭐. Revisar conversación." |
| Fuera de horario laboral | BAJA | Enviar `outsideHoursMessage`. Mantener bot activo para FAQs. | — |
| Agente hace clic en "Tomar conversación" | — | Assignar agente. Bot se silencia. Agente responde manualmente. | — |
| Agente hace clic en "Devolver al bot" | — | Desasignar agente. Bot retoma con contexto. | — |

---

## 5. Diagramas de Flujo de Integración

### 5.1 WhatsApp Webhook → Respuesta (Happy Path)

```
┌──────────┐    POST /api/ai/whatsapp/webhook/:hotelId    ┌───────────────┐
│  Meta    │ ──────────────────────────────────────────────> │  Arckode      │
│  WhatsApp│                                               │  Backend      │
│  Cloud   │ <────────────────────────────────────────────── │  :3000        │
│  API     │    200 OK (async, el bot responde después)     │               │
└──────────┘                                               └───────┬───────┘
                                                                    │
    1. Validar HMAC firma                                           │
    2. Extraer: hotelId, sender phone, message content               │
    3. Buscar/crear AiConversations                                 │
    4. franc-min → detectar idioma                                  │
    5. NLP fuzzy → detectar intent                                  │
       ├─ score > 0.65 → intent match                               │
       └─ score < 0.65 → LLM classify (Z.AI GLM)                    │
    6. Si intent.action → ejecutar acción:                          │
       ├─ search_rooms → query ORM Reservations + Rooms             │
       ├─ create_booking → crear Guest + Reservation                │
       ├─ register_incident → crear Ticket                          │
       ├─ send_payment_link → Stripe checkout                       │
       └─ escalate → notificar agentes (WebSocket)                  │
    7. Rellenar responseTemplate con variables:                     │
       ├─ {guestName} → conversation.guestName                      │
       ├─ {hotelName} → hotel.name                                  │
       ├─ {roomType} → room.type                                    │
       └─ {totalAmount} → booking flow total                        │
    8. Enviar respuesta vía WhatsApp Cloud API                       │
    9. Guardar ai_messages (sender=bot, intentDetected, confidence)  │
   10. Actualizar ai_metrics_daily (async, no bloquea)               │
                                                                    │
┌──────────┐    POST /{phoneNumberId}/messages    ┌───────────────┐ │
│  Meta    │ <──────────────────────────────────── │  Arckode      │ │
│  WhatsApp│                                      │  Backend      │─┘
└──────────┘                                      └───────────────┘
```

### 5.2 Booking Flow Completo (Conversación WhatsApp)

```
Huésped: "Hola, quiero reservar"
  → Intent: greeting → "¡Bienvenido a Paraíso Tropical! ¿En qué te ayudo?"
Huésped: "Quiero una habitación para el 15 de julio"
  → Intent: booking_request → Inicia flow (step=init)
Bot: "¿Qué fechas te interesan? Ejemplo: 15 julio → 18 julio"
Huésped: "15 al 18 de julio, 2 adultos"
  → NLP parse: checkIn=2026-07-15, checkOut=2026-07-18, adults=2
  → Action: search_rooms(hotelId, checkIn, checkOut)
  → Result: 3 tipos disponibles
Bot: "Para 15-18 Jul, 2 adultos, tengo:
      🏨 Deluxe — $120/noche (total $360)
      🏨 Suite Junior — $180/noche (total $540)
      🏨 Suite Ejecutiva — $250/noche (total $750)
      ¿Cuál prefieres?"
Huésped: "Deluxe"
  → step=room_select, selectedRoomType=deluxe
Bot: "¡Excelente elección! Deluxe incluye: wifi, TV, AC, balcón.
      ¿Te gustaría agregar desayuno? (+$15/persona/día)
      ¿O traslado al aeropuerto? (+$40)"
Huésped: "Solo la habitación, gracias"
  → step=confirm
Bot: "Resumen: Deluxe, 15-18 Jul, 2 adultos. Total: $360.
      Para confirmar, necesito tu nombre y email."
Huésped: "Juan Pérez, juan@email.com"
  → Action: create_guest(name=Juan Pérez, email=juan@email.com)
  → Action: create_reservation(roomId, checkIn, checkOut, guestId, total=360)
  → Action: create_payment_link(reservationId, amount=360)
  → step=payment
Bot: "¡Listo Juan! Tu reserva está pre-reservada.
      Para confirmar, realiza el pago de $360 aquí:
      🔗 https://pay.hotel.com/link/abc123
      Tu reserva expira en 24 horas si no se confirma el pago."
... 20 min después, webhook Stripe confirma pago ...
  → step=done
Bot: "✅ ¡Pago confirmado, Juan! Tu reserva #RES-12345 está confirmada.
      📅 Check-in: 15 julio desde las 14:00
      📅 Check-out: 18 julio hasta las 12:00
      📍 Paraíso Tropical, Calle Principal 123
      ¿Necesitas algo más?"
```

### 5.3 Incident Flow (Queja → Resolución)

```
Huésped: "El aire acondicionado no funciona en la habitación 304"
  → Intent: maintenance_request (confidence 0.89)
  → Action: create_maintenance_ticket
Bot: "Lamento el inconveniente. He registrado el reporte del AC en la habitación 304.
      El equipo de mantenimiento lo revisará en breve. ¿Necesitas algo más mientras tanto?"
  → Backend: POST /api/ai/conversations/:id/incident
    → Crea Ticket (category=maintenance, priority=high, description=...)
    → Crea Maintenance task en módulo mantenimiento vía connector
    → F5 a mantenimiento: "AC descompuesto Hab 304 — huésped {guestName}"
Huésped: "Gracias"
  → Intent: gratitude
Bot: "¡De nada! Tu comodidad es nuestra prioridad. ¿Cómo calificarías esta atención? 1⭐-5⭐"
```

### 5.4 Payment Flow

```
Huésped: "Quiero pagar mi reserva"
  → Intent: payment_request
Bot: "Déjame buscar tu reserva. ¿Tu número de confirmación o email?"
Huésped: "juan@email.com"
  → Action: lookup_reservation_by_email → encuentra RES-12345
Bot: "Encontré tu reserva #RES-12345. Deluxe, 15-18 Jul, Total: $360.
      ¿Procedo con el pago?"
Huésped: "Sí"
  → Action: create_payment_link(reservationId, amount=360)
  → Stripe Checkout Session creada
Bot: "Aquí está tu enlace de pago:
      🔗 https://pay.hotel.com/link/abc456
      Total: $360 USD"
... Huésped paga ...
  → Webhook Stripe: checkout.session.completed
  → Backend: marca reservation.deposit += 360, status=confirmed
Bot: "✅ Pago recibido. Tu reserva #RES-12345 está confirmada. ¡Te esperamos!"
```

### 5.5 Cross-Module Connectors (Backend)

```
ai-recepcionista ──┬──> reservas     (crear/modificar/cancelar reservas)
                   ├──> huespedes    (crear/consultar huéspedes)
                   ├──> habitaciones (consultar availability)
                   ├──> folios       (consultar saldo, cargos)
                   ├──> payments     (generar payment links)
                   ├──> housekeeping (crear tareas de limpieza)
                   ├──> mantenimiento(crear tickets de mantenimiento)
                   ├──> tickets      (registrar incidencias)
                   ├──> hoteles      (leer info del hotel, amenities)
                   ├──> canales      (push availability si booking creado)
                   └──> notificaciones (F5 a agentes en recepción)
```

---

## 6. API Endpoints (Backend — módulo `ai-recepcionista`)

### 6.1 Conversaciones

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/ai/conversations` | hotel_admin, receptionist, super_admin | Listar conversaciones (paginado, filtros) |
| GET | `/api/ai/conversations/:id` | hotel_admin, receptionist, super_admin | Detalle de conversación + mensajes |
| POST | `/api/ai/conversations/:id/messages` | hotel_admin, receptionist (agente) | Enviar mensaje como agente |
| POST | `/api/ai/conversations/:id/transfer` | hotel_admin, receptionist | Transferir bot → agente (o viceversa) |
| POST | `/api/ai/conversations/:id/close` | hotel_admin, receptionist | Cerrar conversación |
| POST | `/api/ai/conversations/:id/rate` | público (guest token) | Calificar satisfacción (1-5) |
| POST | `/api/ai/conversations/:id/incident` | interno (bot) | Registrar incidencia desde el bot |

### 6.2 Intenciones (CRUD)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/ai/intents` | hotel_admin | Listar intenciones del hotel |
| POST | `/api/ai/intents` | hotel_admin | Crear intención personalizada |
| PUT | `/api/ai/intents/:id` | hotel_admin | Editar intención |
| DELETE | `/api/ai/intents/:id` | hotel_admin | Eliminar (solo si isSystem=0) |
| POST | `/api/ai/intents/:id/test` | hotel_admin | Probar intención con mensaje simulado |

### 6.3 Plantillas

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/ai/templates` | hotel_admin | Listar plantillas |
| POST | `/api/ai/templates` | hotel_admin | Crear plantilla |
| PUT | `/api/ai/templates/:id` | hotel_admin | Editar plantilla |
| DELETE | `/api/ai/templates/:id` | hotel_admin | Eliminar plantilla |

### 6.4 WhatsApp Config

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/ai/whatsapp/config` | hotel_admin | Ver configuración WhatsApp |
| PUT | `/api/ai/whatsapp/config` | hotel_admin | Guardar/actualizar configuración |
| POST | `/api/ai/whatsapp/config/test` | hotel_admin | Probar conexión (envía msg de prueba) |
| GET | `/api/ai/whatsapp/webhook/:hotelId` | público (verificación) | Webhook verification (GET con verify_token) |
| POST | `/api/ai/whatsapp/webhook/:hotelId` | público (HMAC) | Webhook entrante de mensajes |

### 6.5 Web Chat Público

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/ai/chat/:hotelSlug` | público | Enviar mensaje desde widget web |
| GET | `/api/ai/chat/:hotelSlug/session` | público | Crear/recuperar sesión de chat web |

### 6.6 Métricas

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/ai/metrics` | hotel_admin | Métricas (hoy/semana/mes) |
| GET | `/api/ai/metrics/dashboard` | hotel_admin | Dashboard KPIs en tiempo real |
| POST | `/api/ai/metrics/aggregate` | cron (interno) | Agregar métricas del día (night audit) |

---

## 7. Estructura del Módulo Backend

```
backend/src/modules/ai-recepcionista/
├── index.ts                    # Puerta pública (createModule + contrato)
├── model.ts                    # orm.define() de las 7 tablas
├── types.ts                    # DTOs, Records, Enums, Interfaces
├── service.ts                  # AiRecepcionistaService (lógica core)
├── controller.ts               # Handlers HTTP (thin, delegate to service)
├── sockets.ts                  # Eventos WebSocket
├── validators/
│   └── schema.ts               # ValidationRule schemas
├── usecases/
│   ├── nlp-engine.ts           # Motor NLP: fuzzy match + LLM classify
│   ├── response-builder.ts     # Construye respuestas con variables
│   ├── booking-flow.ts         # Orquesta el flujo de reserva paso a paso
│   ├── escalate.ts             # Lógica de escalamiento a agente humano
│   ├── whatsapp-client.ts      # Cliente HTTP WhatsApp Cloud API
│   ├── webhook-handler.ts      # Procesa webhooks entrantes (WhatsApp, Stripe)
│   ├── language-detector.ts    # Detección de idioma (franc-min)
│   └── metrics-aggregator.ts   # Agregación nocturna de métricas
└── tests/
    ├── service.test.ts
    ├── nlp-engine.test.ts
    ├── booking-flow.test.ts
    ├── response-builder.test.ts
    └── webhook-handler.test.ts
```

### 7.1 Contrato del módulo

```typescript
export const AiRecepcionistaModule = () => createModule({
  name: 'ai-recepcionista',
  version: '1.0.0',
  description: 'Recepcionista Virtual con IA — atención multicanal al huésped',
  contract: {
    name: 'ai-recepcionista',
    version: '1.0.0',
    description: 'AI receptionist: chat, NLP, WhatsApp, booking flows, escalation',
    actions: [
      'listConversations', 'getConversation', 'sendMessage',
      'transferConversation', 'closeConversation', 'rateConversation',
      'registerIncident',
      'listIntents', 'createIntent', 'updateIntent', 'deleteIntent', 'testIntent',
      'listTemplates', 'createTemplate', 'updateTemplate', 'deleteTemplate',
      'getWhatsappConfig', 'updateWhatsappConfig',
      'processWebhook', 'processWebChat',
      'getMetrics', 'aggregateDailyMetrics',
    ],
    events: [
      'onConversationStarted', 'onMessageReceived', 'onBotReplied',
      'onConversationTransferred', 'onConversationClosed',
      'onIncidentRegistered', 'onBookingCreated', 'onPaymentRequested',
    ],
    tables: [
      'ai_conversations', 'ai_messages', 'ai_intents', 'ai_templates',
      'ai_whatsapp_config', 'ai_metrics_daily', 'ai_booking_flows',
    ],
    dependencies: ['auth', 'reservas', 'huespedes', 'habitaciones', 'folios', 'payments'],
    rules: ['No importar de otros módulos', 'RepositoryAdapter<T>', 'Validación en controller'],
  },
  create({ logger, orm, cache, router, auth }) { ... },
})
```

---

## 8. Frontend — Páginas y Componentes

### 8.1 Vista 1: Chat IA / Recepcionista (`/panel/ai-receptionist/chat`)

**Componentes:**
- `ConversationSidebar.vue` — Lista de conversaciones activas con filtros
- `ChatWindow.vue` — Ventana de chat con mensajes + input
- `ConversationCard.vue` — Preview de conversación en sidebar
- `MessageBubble.vue` — Burbuja de mensaje (guest/bot/agent)
- `TransferModal.vue` — Modal de reasignación de agente
- `IncidentModal.vue` — Modal de registro de incidencia

**Decision Table — UI:**

| Trigger | Condición | Resultado | Estados |
|---------|-----------|-----------|---------|
| Clic conversación sidebar | status=active | Carga mensajes en ChatWindow | Loading: skeleton mensajes. Empty: "Sin mensajes aún" |
| Enviar mensaje (agente) | Agente asignado | POST message, aparece en chat | Loading: spinner en send button. Error: toast "No se pudo enviar" |
| Botón "Tomar" | assignedAgentId=null | Asigna agente, bot pausa | Toast: "Conversación tomada" |
| Botón "Devolver al bot" | Agente asignado | Desasigna agente, bot retoma | Toast: "Devuelta al bot" |
| Botón "Cerrar" | status=active | Modal confirm → close | Error si ya cerrada |
| Filtro "Todas/Bot/Agente/Espera" | — | Filtra lista sidebar | — |
| Búsqueda por nombre/teléfono | — | Filtra en tiempo real | Empty: "Sin resultados" |
| Botón "Ver perfil huésped" | guestId presente | Navega a /panel/guests/:id | — |
| Botón "Incidentes" | — | Abre IncidentModal | — |

### 8.2 Vista 2: Configuración del Bot (`/panel/ai-receptionist/config`)

**Componentes:**
- `IntentList.vue` — Tabla CRUD de intenciones
- `IntentFormModal.vue` — Formulario crear/editar intención
- `TemplateList.vue` — Tabla de plantillas
- `TemplateFormModal.vue` — Formulario crear/editar plantilla
- `WhatsappConfigForm.vue` — Formulario configuración WhatsApp
- `TestChat.vue` — Mini-chat para probar intenciones

**Decision Table — UI:**

| Trigger | Condición | Resultado | Estados |
|---------|-----------|-----------|---------|
| "+ Nueva Intención" | — | Modal form | — |
| Guardar intención | name + triggerPhrases + responseTemplate | POST /api/ai/intents | Loading: spinner. Error: E1 campos obligatorios. Success: toast |
| Toggle Activa/Inactiva | — | PATCH active | Loading en toggle |
| Eliminar intención | isSystem=0 | Modal danger → DELETE | Error si isSystem=1 |
| Probar intención | — | Abre TestChat con intent seleccionado | — |
| "Configurar WhatsApp" | — | Form: phoneNumberId, accessToken, verifyToken | — |
| Guardar WhatsApp | Campos válidos | PUT config | Success: "WhatsApp configurado" + badge "Conectado" |
| Probar webhook | WhatsApp configurado | POST test → envía msg de prueba | Toast: "Mensaje enviado" o "Error de conexión" |
| Horario atención | — | Time pickers: start/end + días | — |

### 8.3 Vista 3: Historial (`/panel/ai-receptionist/history`)

**Componentes:**
- `ConversationTable.vue` — Tabla paginada con filtros avanzados
- `ConversationDetailModal.vue` — Modal con chat completo + métricas
- `ExportButton.vue` — Descargar CSV/PDF

### 8.4 Vista 4: Dashboard Métricas (`/panel/ai-receptionist/metrics`)

**Componentes:**
- `MetricsKpiCards.vue` — KPIs principales (resolución, satisfacción, escalamiento)
- `IntentBarChart.vue` — Top intenciones del período
- `ChannelPieChart.vue` — Distribución por canal
- `ResponseTimeChart.vue` — Tiempo promedio de respuesta
- `PeriodSelector.vue` — Hoy / Semana / Mes / Personalizado

---

## 9. Estrategia NLP — Motor de Intenciones

### 9.1 Algoritmo Fuzzy Match (primera línea)

```
Input: userMessage (string), intents (AiIntents[] activas para el hotel)
Output: { intent: AiIntent, confidence: number } | null

1. Normalizar mensaje: lowercase, remove accents, strip punctuation
2. Tokenizar: split por whitespace → tokens[]
3. Para cada intent activa:
   a. Para cada triggerPhrase de la intent:
      - Calcular Jaro-Winkler similarity entre normalizedMessage y triggerPhrase
      - Calcular overlap de tokens (intersección / unión)
      - Score = (similarity * 0.6) + (overlap * 0.4)
   b. Guardar el mejor score para esta intent
4. Ordenar intents por (score * 0.7) + (priority * 0.3)
5. Si best.score > intent.confidenceThreshold → return { intent, confidence: best.score }
6. Si no → return null (activar LLM fallback)
```

### 9.2 LLM Fallback (segunda línea, Z.AI GLM)

```
Input: userMessage, intents[] (top 5 del fuzzy), conversationContext
Output: { intent: AiIntent, generatedResponse: string }

Prompt del LLM:
"Eres recepcionista de {hotelName}. El huésped dice: '{userMessage}'.
 Contexto: conversación previa: {last3Messages}.
 Intenciones posibles: {intentNames}.
 Responde SOLO en JSON: { intent: 'nombre_intent', response: 'texto_respuesta' }"
```

### 9.3 Variables Dinámicas

Las respuestas (templates y LLM) soportan variables que se reemplazan con datos reales:

| Variable | Fuente | Ejemplo |
|----------|--------|---------|
| `{guestName}` | conversation.guestName o guest.name | "Juan" |
| `{hotelName}` | hotel.name | "Paraíso Tropical" |
| `{roomType}` | room.type | "Deluxe" |
| `{roomNumber}` | room.number | "304" |
| `{checkInDate}` | reservation.checkIn | "15 julio 2026" |
| `{checkOutDate}` | reservation.checkOut | "18 julio 2026" |
| `{checkInTime}` | hotel.checkIn | "14:00" |
| `{checkOutTime}` | hotel.checkOut | "12:00" |
| `{totalAmount}` | reservation.totalAmount | "$360" |
| `{nights}` | calculated | "3" |
| `{wifiNetwork}` | hotel.wifiNetwork | "Paradise_Guest" |
| `{wifiPassword}` | hotel.wifiPassword | "welcome2024" |
| `{currency}` | hotel.currency | "USD" |
| `{paymentLink}` | generated | "https://pay.hotel.com/abc" |
| `{botName}` | configurable | "Sofía" |

---

## 10. Seguridad y Rate Limiting

| Aspecto | Medida |
|---------|--------|
| **WhatsApp webhook** | HMAC-SHA256 firma validada por mensaje |
| **Tokens WhatsApp** | Encriptados en DB (AES-256). Nunca expuestos en API responses. |
| **Rate limit WhatsApp** | 250 msg/s por phone number (Meta impone). Cola interna si se excede. |
| **Rate limit web chat** | 10 msg/min por IP (anti-spam). |
| **Rate limit LLM calls** | Máx 50 llamadas/min por hotel. Cache de respuestas idénticas (TTL 300s). |
| **Datos sensibles** | Nunca loguear accessToken, phoneNumberId en logs. |
| **Ownership check** | Toda operación filtra por hotelId. Agente solo ve conversaciones de su hotel. |
| **Guest token** | Token JWT de corta duración (15 min) para web chat público y rate endpoint. |

---

## 11. Plan de Implementación (Fases)

### Fase 1 — Foundation (Semana 1-2)
- [ ] Crear módulo `ai-recepcionista` con `make:module`
- [ ] Crear 7 tablas (`model.ts` + `orm.define` en composition-root)
- [ ] Tipos, validators, controller skeleton
- [ ] CRUD de intenciones (`ai_intents`)
- [ ] CRUD de plantillas (`ai_templates`)
- [ ] CRUD de configuración WhatsApp (`ai_whatsapp_config`)
- [ ] Frontend: página config con CRUD intenciones + plantillas
- [ ] `arckode analyze` = 0 violaciones
- [ ] `bun test` = tests básicos pass

### Fase 2 — NLP Engine (Semana 3-4)
- [ ] `usecases/nlp-engine.ts`: fuzzy match + LLM fallback
- [ ] `usecases/language-detector.ts` (franc-min)
- [ ] `usecases/response-builder.ts` (variables dinámicas)
- [ ] 25 intenciones pre-entrenadas seed
- [ ] Tests NLP: 100 frases de entrenamiento
- [ ] Endpoint `POST /api/ai/intents/:id/test`
- [ ] TestChat en frontend para probar intenciones

### Fase 3 — Chat & Web (Semana 5-6)
- [ ] Web Chat widget público (`POST /api/ai/chat/:hotelSlug`)
- [ ] Webhook WhatsApp entrante (`POST /api/ai/whatsapp/webhook/:hotelId`)
- [ ] `usecases/whatsapp-client.ts` (Meta Cloud API)
- [ ] Conversaciones + mensajes CRUD
- [ ] Frontend: ChatWindow + ConversationSidebar
- [ ] Transfer bot ↔ agente
- [ ] F5 notificaciones a recepción

### Fase 4 — Booking & Payments (Semana 7)
- [ ] `usecases/booking-flow.ts` (7-step flow)
- [ ] Tabla `ai_booking_flows` + state machine
- [ ] Conector ai → reservas (crear reserva desde bot)
- [ ] Conector ai → payments (generar payment link)
- [ ] Conector ai → huespedes (crear/consultar guest)
- [ ] Conector ai → habitaciones (search availability)
- [ ] Flow de pago integrado (Stripe webhook → confirmación)

### Fase 5 — Incidencias & Concierge (Semana 8)
- [ ] `usecases/escalate.ts` completo
- [ ] Conector ai → housekeeping (crear tareas)
- [ ] Conector ai → mantenimiento (crear tickets)
- [ ] Conector ai → tickets (registrar incidencias)
- [ ] Conector ai → folios (consultar saldo)
- [ ] `usecases/metrics-aggregator.ts` (night audit)
- [ ] Frontend: Dashboard de métricas
- [ ] Frontend: Historial de conversaciones
- [ ] Gate final: analyze=0, typecheck=0, tests≥50

---

## 12. Conectores Cross-Módulo (Backend)

```typescript
// connectors/ai-reservas.ts
export const aiReservasConnector: ConnectorDef = {
  name: 'ai-reservas',
  source: 'ai-recepcionista',
  target: 'reservas',
  create({ system }) {
    const ai = system.resolveModule<AiRecepcionistaService>('ai-recepcionista')
    const reservas = system.resolveModule<ReservasService>('reservas')
    // ai → reservas: crear reserva desde booking flow
    return { onBookingRequest: (data) => reservas.create(data) }
  },
}

// connectors/ai-payments.ts
// connectors/ai-housekeeping.ts
// connectors/ai-mantenimiento.ts
// connectors/ai-habitaciones.ts (availability)
```

---

## 13. Seed Data — Intenciones y Templates del Sistema

Al ejecutar `bun run migrate`, se insertan automáticamente:

- **25 intenciones** del sistema (isSystem=1, no eliminables)
- **10 templates** predefinidos (bienvenida, fuera de horario, checkout recordatorio, queja resuelta, etc.)
- **Config WhatsApp default** (inactiva hasta que el hotel la configure)

---

## 14. Riesgos y Mitigaciones

| Riesgo | Impacto | Prob | Mitigación |
|--------|---------|------|------------|
| WhatsApp API rate limits | Alto | Baja | Cola interna + throttle por hotel |
| LLM responde mal (alucinaciones) | Alto | Media | Template-first approach. LLM solo como fallback. Variables siempre del PMS. |
| Overbooking por reserva duplicada | Alto | Baja | Atomic check de disponibilidad antes de crear reserva (mismo overlap check que widget público) |
| Token WhatsApp expuesto en logs | Crítico | Baja | Sanitización de logs. Encriptación en DB. Nunca en API responses. |
| Bot no entiende acentos regionales | Medio | Alta | NLP fuzzy normaliza accents. Entrenar con variantes regionales. |
| Escalamiento sin agente disponible | Medio | Media | Cola de espera. Auto-mensaje después de 5 min: "Seguimos conectándote..." |

---

## 15. Métricas de Éxito

| KPI | Target | Medición |
|-----|--------|----------|
| Resolución por bot | > 70% | `botResolved / totalConversations` |
| Tiempo respuesta bot | < 2s | `avgResponseTimeMs` |
| Satisfacción huésped | > 4.0 | `avgSatisfaction` |
| Tasa de escalamiento | < 30% | `escalatedToHuman / total` |
| Bookings generados por bot | > 15% del total | `bookingsGenerated` vs reservas totales |
| Upsells aceptados | > 10% | `upsellsAccepted / bookingsGenerated` |
| Quejas resueltas por bot | > 50% | `complaintsResolved / totalComplaints` |

---

*Documento alineado con arckode-framework conventions, arquitectura multi-tenant, y reglas del proyecto ManagerHotel.*
