# FRD · M06 — Recepcionista Virtual con IA

> **Módulo NO implementado (target/spec).** Este documento define el alcance target del chatbot de atención al huésped con IA, integración WhatsApp, y respuestas automáticas. NO existe código en frontend ni backend — todo es especificación para desarrollo futuro.
>
> **Veredicto del módulo:** 🔴 No implementado. Sin backend, sin frontend, sin integración WhatsApp.

**Módulo:** M06 — Recepcionista Virtual con IA
**Pantallas cubiertas (target):** Chat IA (`/panel/ai/recepcionista`) · Configuración del chatbot (`/panel/ai/config`) · Historial de conversaciones (`/panel/ai/conversations`) · Dashboard de métricas IA (`/panel/ai/metrics`)
**Servicios frontend (target):** `AIRecepcionista.service.ts`, `WhatsApp.service.ts`
**Servicios backend (target):** módulo `ai-recepcionista` (chat engine, NLP, integraciones)

---

## 1. Modelo de datos (target schema)

### 1.1 Conversaciones (`ai_conversations`)

| Campo | Tipo | Reglas | Descripción |
|-------|------|--------|-------------|
| `id` | string | required, uuid | Identificador único de conversación |
| `guestId` | string | nullable, FK → `guests.id` | Huésped asociado (null si no registrado) |
| `channel` | enum | required | `whatsapp` · `webchat` · `sms` · `app_guest` |
| `channelConversationId` | string | indexed | ID del hilo en el canal externo (WhatsApp phone ID) |
| `hotelId` | string | indexed, multi-tenant | Hotel propietario |
| `status` | enum | required | `active` · `resolved` · `transferred` · `bot_failed` |
| `startedAt` | datetime | required | Inicio de la conversación |
| `endedAt` | nullable | — | Cierre de la conversación |
| `satisfactionScore` | number | nullable, 1-5 | Rating del huésped al cerrar |
| `resolvedBy` | enum | nullable | `bot` · `agent` · `hybrid` |
| `assignedAgentId` | string | nullable, FK → `users.id` | Agente humano asignado |

### 1.2 Mensajes (`ai_messages`)

| Campo | Tipo | Reglas | Descripción |
|-------|------|--------|-------------|
| `id` | string | required, uuid | ID del mensaje |
| `conversationId` | string | required, FK → `ai_conversations.id` | Conversación padre |
| `sender` | enum | required | `guest` · `bot` · `agent` |
| `content` | text | required | Texto del mensaje |
| `contentType` | enum | default `text` | `text` · `image` · `document` · `location` · `template` |
| `intentDetected` | string | nullable | Intención NLP detectada por el bot |
| `confidence` | number | nullable, 0-1 | Confianza del modelo NLP |
| `createdAt` | datetime | required | Timestamp del mensaje |

### 1.3 Intenciones entrenadas (`ai_intents`)

| Campo | Tipo | Reglas | Descripción |
|-------|------|--------|-------------|
| `id` | string | required | ID de la intención |
| `hotelId` | string | indexed | Hotel propietario |
| `name` | string | required | Nombre descriptivo (ej: "consultar_checkin") |
| `triggerPhrases` | json | required, array | Frases de entrenamiento |
| `responseTemplate` | text | required | Respuesta template del bot |
| `action` | enum | nullable | Acción automática asociada |
| `fallbackResponse` | text | required | Respuesta si confianza < umbral |
| `priority` | number | default 0 | Desempate entre intenciones similares |
| `active` | number | default 1 | Habilitada/deshabilitada |

### 1.4 Plantillas de respuesta (`ai_templates`)

| Campo | Tipo | Reglas | Descripción |
|-------|------|--------|-------------|
| `id` | string | required | ID de la plantilla |
| `hotelId` | string | indexed | Hotel propietario |
| `category` | enum | required | `greeting` · `faq` · `service` · `complaint` · `checkout` · `emergency` |
| `trigger` | string | required | Palabra/gatillo que activa la plantilla |
| `responseEs` | text | required | Respuesta en español |
| `responseEn` | text | nullable | Respuesta en inglés |
| `variables` | json | nullable, array | Variables dinámicas: `{guestName}`, `{roomNumber}`, `{checkOutDate}` |
| `active` | number | default 1 | — |

### 1.5 Métricas diarias (`ai_metrics_daily`)

| Campo | Tipo | Reglas | Descripción |
|-------|------|--------|-------------|
| `id` | string | required | — |
| `hotelId` | string | indexed | — |
| `date` | date | required, unique(hotelId,date) | — |
| `totalConversations` | number | default 0 | Conversaciones del día |
| `botResolved` | number | default 0 | Resueltas 100% por bot |
| `hybridResolved` | number | default 0 | Bot + agente |
| `agentResolved` | number | default 0 | Solo agente |
| `escalatedToHuman` | number | default 0 | Transferencias a agente |
| `avgConfidence` | number | default 0 | Confianza promedio del NLP |
| `avgSatisfaction` | number | default 0 | Satisfacción promedio |
| `topIntents` | json | nullable | Top 5 intenciones del día |
| `avgResponseTimeMs` | number | default 0 | Tiempo promedio de respuesta del bot |

### 1.6 Integración WhatsApp (`ai_whatsapp_config`)

| Campo | Tipo | Reglas | Descripción |
|-------|------|--------|-------------|
| `id` | string | required | — |
| `hotelId` | string | unique | Un config por hotel |
| `phoneNumberId` | string | required | WhatsApp Business phone number ID |
| `accessToken` | string | required | Token de WhatsApp Business API |
| `verifyToken` | string | required | Token de verificación del webhook |
| `webhookUrl` | string | computed | URL del webhook: `{baseUrl}/api/ai/whatsapp/webhook` |
| `active` | number | default 1 | Habilitar/deshabilitar WhatsApp |
| `businessHours` | json | nullable | Horario: `{ from: '08:00', to: '22:00' }` |
| `outsideHoursMessage` | text | nullable | Mensaje fuera de horario |
| `transferAgentPhone` | string | nullable | Número de agente para escalamiento |

---

## 2. Pantalla — Chat IA / Recepcionista Virtual (`/panel/ai/recepcionista`)

> ⚠ **NO implementado.** Toda esta sección es TARGET.

Interfaz de chat en tiempo real. Simula la conversación que ve el huésped (modo preview) o permite al agente intervenir. Lista de conversaciones activas en sidebar izquierdo.

### 2.1 Decision Table

| Trigger (botón/acción) | Condición / Estado previo | Resultado | Modal/Toast (texto literal) | Errores posibles | Notificación F5 |
|------------------------|---------------------------|-----------|------------------------------|------------------|-----------------|
| Clic en conversación de la lista sidebar | `conversation.status = active` | Abre hilo de chat en panel derecho, carga mensajes | — | E4 "Conversación no encontrada" | — |
| Botón **"Tomar conversación"** (cuando bot no resolvió) | `conversation.assignedAgentId = null` | Asigna agente actual, `status → active`, bot se desactiva | Toast success: "Conversación tomada. Respondés como agente." | E3 "No tenés permiso para intervenir" · E6 "Sin conexión" | — |
| Botón **"Enviar mensaje"** (agente escribe y envía) | agente asignado, `sender = agent` | POST `/api/ai/conversations/:id/messages` con `sender=agent` | — (el mensaje aparece en el chat) | E4 "Conversación cerrada" · E6 | — |
| Botón **"Transferir a bot"** (agente devuelve al bot) | agente asignado | `assignedAgentId → null`, bot retoma | Toast success: "Conversación devuelta al bot. El bot responderá automáticamente." | E6 | — |
| Botón **"Cerrar conversación"** | `conversation.status = active` | `status → resolved`, `endedAt = now()`, `resolvedBy = agent` | Modal `confirm`: "¿Cerrar conversación con {huésped}?" → Toast success: "Conversación cerrada." | E6 | — |
| Botón **"Marcar como satisfecha"** (⭐) | conversación cerrada | PATCH `satisfactionScore` | — | E6 | — |
| Botón **"Ver en WhatsApp"** | `channel = whatsapp` | Abre chat en WhatsApp Business | — | — | — |
| Botón **"Reasignar agente"** | conversación activa | Abre modal con lista de agentes disponibles | Modal `form`: "Reasignar a…" | — | — |
| Filtro **"Todas / Bot / Agente / Pendientes"** (toolbar) | — | Filtra sidebar por `status` o `resolvedBy` | — | — | — |
| Búsqueda por nombre de huésped en sidebar | — | Filtra conversaciones por nombre parcial | — | — | — |
| **"Preferencia de idioma"** toggle | conversación activa | Cambia idioma de respuestas bot (`responseEn` vs `responseEs`) | Toast info: "Bot ahora responde en inglés." | — | — |

**Gap actual:** todo es gap. No hay chat, no hay sidebar de conversaciones, no hay intervención de agente, no hay métricas.

### 2.2 Flow — Conversación bot → agente → cierre

```mermaid
flowchart TD
    A([Huésped envía mensaje WhatsApp/web]) --> B{Bot reconoce intención?}
    B -- sí, confianza > umbral --> C[Bot responde automáticamente]
    C --> D{Huésped satisfecho?}
    D -- sí, dice "gracias" o califica --> E[Conversación resolved por bot]
    D -- no, repite o expresa frustración --> F{Intentos fallidos > 3?}
    B -- no, confianza < umbral --> F
    F -- sí --> G[Bot: 'Un momento, te transfiero a un asesor.']
    G --> H[POST /api/ai/conversations/:id/transfer]
    H --> I[Notificación F5 a recepción: 'Huésped {nombre} necesita asesor']
    I --> J{Agente disponible?}
    J -- sí --> K[Agente toma conversación]
    K --> L[Agente responde manualmente]
    L --> M[Conversación resolved por agent]
    J -- no --> N[Cola de espera: 'Estamos conectándote...']
    N --> O[F5 a todos los agentes: 'Conversación en espera']
    O --> J
    M --> P[Toast success: 'Conversación con {huésped} cerrada.']
    E --> Q([Fin])
    P --> Q
```

### 2.3 Flow — Mensaje entrante (WhatsApp webhook)

```mermaid
flowchart TD
    A([Webhook POST /api/ai/whatsapp/webhook]) --> B[Valida firma WhatsApp]
    B --> Firma inválida? --> X1[401: Firma inválida]
    B --> OK --> C{Conversación activa?}
    C -- sí --> D[Añade mensaje a ai_messages]
    C -- no --> E[Crea nueva conversación en ai_conversations]
    D --> F[Detecta intención NLP]
    E --> F
    F --> G{Confianza > 0.7?}
    G -- sí --> H[Busca responseTemplate de la intención]
    H --> I[Variables: guestName, roomNumber, etc.]
    I --> J[POST mensaje al canal WhatsApp]
    G -- no --> K{Dentro de horario laboral?}
    K -- sí --> L[Respuesta fallback + opción transferir]
    K -- no --> M[outsideHoursMessage + crear ticket F5]
    J --> N[Registra en ai_metrics_daily]
    L --> N
    M --> N
```

---

## 3. Pantalla — Configuración del Chatbot (`/panel/ai/config`)

> ⚠ **TARGET.** No implementado.

Panel de configuración del comportamiento del bot para cada hotel.

### 3.1 Decision Table

| Trigger | Condición | Resultado | Modal/Toast (texto) | Errores | Notif F5 |
|---------|-----------|-----------|----------------------|---------|----------|
| **"+ Nueva Intención"** | — | Abre modal form: nombre, triggerPhrases, responseTemplate, action | Modal `form`: "Crear Intención" | — | — |
| **"Guardar Intención"** | `name` y `triggerPhrases` presentes, `responseTemplate` presente | POST `/api/ai/intents` | Toast success: "Intención '{nombre}' creada." | E1 "Faltan campos obligatorios" · E2 "Ya existe una intención con ese nombre" · E6 | — |
| Editar intención existente (clic en fila) | — | Abre modal form precargado | Modal `form`: "Editar Intención" | — | — |
| Toggle **"Activa/Inactiva"** de intención | — | PATCH `active` | — | E6 | — |
| **"Eliminar"** intención | `system = 0` | Modal danger: "¿Eliminar intención '{nombre}'? Se perderán las métricas." | Toast success: "Intención eliminada." | E2 "Intención de sistema no se puede eliminar" · E6 | — |
| **"Probar chatbot"** (botón test) | — | Abre mini-chat de simulación | — | — | — |
| **"Configurar WhatsApp"** (pestaña) | — | Abre form: phoneNumberId, accessToken, verifyToken | Modal `form`: "Configurar WhatsApp Business" | E1 "Todos los campos son obligatorios" · E6 | — |
| **"Guardar configuración WhatsApp"** | campos presentes y válidos | POST/PUT `/api/ai/whatsapp/config` | Toast success: "WhatsApp configurado correctamente." | E1 · E6 | — |
| **"Probar webhook"** | WhatsApp configurado | Enviar mensaje de prueba | Toast info: "Mensaje de prueba enviado. Revisá tu WhatsApp." | E6 "No se pudo conectar con WhatsApp API" | — |
| **"Horario de atención"** | — | Form: hora inicio/fin + mensaje fuera de horario | — | — | — |
| **"Idiomas soportados"** | — | Checkboxes: Español, Inglés, Portugués | — | — | — |

### 3.2 Flow — Crear intención + entrenar

```mermaid
flowchart TD
    A([+ Nueva Intención]) --> B[Modal form: nombre + frases + respuesta]
    B --> C[/Admin completa form/]
    C --> D{Validación E1}
    D -- faltan campos --> D1[F3 inline: 'Nombre y respuesta son obligatorios']
    D1 --> C
    D -- ok --> E{Nombre duplicado?}
    E -- sí --> X1[E2 Toast: 'Ya existe una intención con ese nombre.']
    E -- no --> F[POST /api/ai/intents]
    F --> G{HTTP 201?}
    G -- sí --> H[Toast success: 'Intención {nombre} creada.']
    H --> I[Bot ahora reconoce frases de entrenamiento]
    G -- 5xx --> X2[E6 Toast: 'Sin conexión.']
```

---

## 4. Pantalla — Historial de Conversaciones (`/panel/ai/conversations`)

> ⚠ **TARGET.** No implementado.

Tabla paginada de todas las conversaciones históricas con filtros avanzados.

### 4.1 Decision Table

| Trigger | Condición | Resultado | Modal/Toast (texto) | Errores | Notif F5 |
|---------|-----------|-----------|----------------------|---------|----------|
| **Filtros** (fecha, canal, agente, satisfacción, estado) | — | Filtra tabla, resetea paginación | — | — | — |
| **"📥 Exportar CSV"** | — | Genera archivo de conversaciones | Toast success: "Exportación descargada." | E6 | — |
| Clic en fila | — | Abre **modal detail**: mensaje completo, métricas, timeline | Modal `detail` | — | — |
| **"Ver en WhatsApp"** (en detail) | `channel = whatsapp` | Abre chat externo | — | — | — |
| **"Descargar transcripción"** | — | Genera PDF/TXT con todo el chat | — | E6 | — |

---

## 5. Pantalla — Dashboard de Métricas IA (`/panel/ai/metrics`)

> ⚠ **TARGET.** No implementado.

Vista de métricas de performance del chatbot.

### 5.1 KPIs target

| KPI | Cálculo | Target ideal |
|-----|---------|-------------|
| **Resolución por bot** | `botResolved / totalConversations × 100` | > 70% |
| **Tiempo promedio de respuesta** | `avgResponseTimeMs` | < 2s |
| **Satisfacción del huésped** | `avgSatisfaction` (1-5) | > 4.0 |
| **Tasa de escalamiento** | `escalatedToHuman / totalConversations × 100` | < 30% |
| **Top intenciones** | `topIntents` del día | — |
| **Conversaciones activas** | `status = active` en este momento | — |
| **Horas pico** | Agrupación por hora del día | — |

### 5.2 Decision Table

| Trigger | Condición | Resultado | Modal/Toast | Errores | Notif F5 |
|---------|-----------|-----------|-------------|---------|----------|
| Selector **"Hoy / Semana / Mes"** | — | Recalcula métricas para el período | — | E6 | — |
| **"Exportar reporte IA"** | — | Genera PDF con gráficas | Toast success: "Reporte generado." | E6 | — |
| Clic en barra de "Top intenciones" | — | Abre detalle de esa intención (preguntas frecuentes) | Modal `detail` | — | — |
| **"Resetear métricas"** | `role = super_admin` | Modal danger: "¿Borrar métricas del período?" | — | E3 "Sin permiso" | — |

---

## 6. Endpoints target (backend)

| Método | Ruta | Rol | Descripción | ¿Implementado? |
|--------|------|-----|-------------|----------------|
| POST | `/api/ai/conversations` | bot (interno) | Crear conversación | ❌ no implementado |
| GET | `/api/ai/conversations` | hotel_admin, receptionist | Listar conversaciones (filtro por hotelId) | ❌ no implementado |
| GET | `/api/ai/conversations/:id` | hotel_admin, receptionist | Detalle de conversación + mensajes | ❌ no implementado |
| POST | `/api/ai/conversations/:id/messages` | hotel_admin, receptionist, agent | Enviar mensaje (agente o bot) | ❌ no implementado |
| POST | `/api/ai/conversations/:id/transfer` | hotel_admin, receptionist | Transferir de bot a agente | ❌ no implementado |
| PATCH | `/api/ai/conversations/:id/close` | hotel_admin, receptionist | Cerrar conversación | ❌ no implementado |
| POST | `/api/ai/conversations/:id/rate` | guest (app/WhatsApp) | Calificar satisfacción | ❌ no implementado |
| GET | `/api/ai/intents` | hotel_admin | Listar intenciones del hotel | ❌ no implementado |
| POST | `/api/ai/intents` | hotel_admin | Crear intención | ❌ no implementado |
| PUT | `/api/ai/intents/:id` | hotel_admin | Editar intención | ❌ no implementado |
| DELETE | `/api/ai/intents/:id` | hotel_admin | Eliminar intención (no system) | ❌ no implementado |
| GET | `/api/ai/templates` | hotel_admin | Listar plantillas | ❌ no implementado |
| POST | `/api/ai/templates` | hotel_admin | Crear plantilla | ❌ no implementado |
| PUT | `/api/ai/templates/:id` | hotel_admin | Editar plantilla | ❌ no implementado |
| GET | `/api/ai/metrics` | hotel_admin | Métricas diarias/mensuales | ❌ no implementado |
| POST | `/api/ai/metrics/aggregate` | cron/super_admin | Agregar métricas del día | ❌ no implementado |
| GET | `/api/ai/whatsapp/config` | hotel_admin | Ver config WhatsApp | ❌ no implementado |
| PUT | `/api/ai/whatsapp/config` | hotel_admin | Guardar config WhatsApp | ❌ no implementado |
| POST | `/api/ai/whatsapp/webhook` | público (verificado) | Webhook entrante de WhatsApp | ❌ no implementado |
| POST | `/api/ai/whatsapp/send` | hotel_admin, receptionist | Enviar mensaje proactivo vía WhatsApp | ❌ no implementado |
| POST | `/api/ai/test` | hotel_admin | Probar chatbot con mensaje simulado | ❌ no implementado |

---

## 7. Consecuencias cross-módulo (eventos que dispara M06)

| Acción en M06 | Módulo afectado | Efecto | Estado |
|---------------|-----------------|--------|--------|
| Huésped consulta check-in/check-out | M01 — PMS Central | Bot lee datos de reserva para dar info precisa | ❌ target |
| Huésped solicita servicio (room service, limpieza) | M07 — Housekeeping | Crear tarea de housekeeping o servicio | ❌ target |
| Huésped reporta problema | M08 — Mantenimiento | Crear ticket de mantenimiento | ❌ target |
| Huésped hace pregunta de facturación | M13 — Billing | Bot lee folio para dar saldo | ❌ target |
| Huésped califica servicio | M14 — CRM | Feedback se suma al perfil del huésped | ❌ target |
| Conversación escalada a agente | Notificaciones | F5: "Huésped {nombre} necesita asesor" | ❌ target |
| Horario de atención terminado | Notificaciones | Auto-mensaje fuera de horario + crear ticket | ❌ target |

---

## 8. Reglas de negocio (E2)

| # | Regla | Texto canónico | ¿Implementada? |
|---|-------|----------------|----------------|
| 1 | **Conversación activa no puede crear otra con el mismo huésped** | "Ya hay una conversación activa con {huésped}. Cerrá la anterior primero." | ❌ target |
| 2 | **Agente sin permiso no puede tomar conversación** | "No tenés permiso para intervenir conversaciones." | ❌ target |
| 3 | **Conversación cerrada no recibe mensajes** | "La conversación está cerrada. Abrí una nueva." | ❌ target |
| 4 | **WhatsApp phone number duplicado** | "Ya hay un WhatsApp configurado para ese número." | ❌ target |
| 5 | **Intención de sistema no eliminable** | "Las intenciones del sistema no se pueden eliminar." | ❌ target |
| 6 | **Fuera de horario sin agente de guardia** | "Estamos fuera de horario. Dejá tu mensaje y te responderemos mañana." | ❌ target |
| 7 | **Máximo 5 conversaciones activas por agente** | "Tenés 5 conversaciones activas. Cerrá una antes de tomar otra." | ❌ target |
| 8 | **Satisfacción menor a 2 = alerta** | Notificación F5 al admin: "{huésped} calificó con 1-2 estrellas" | ❌ target |

---

## 9. Gap analysis

| # | Feature | Existe hoy | Gap |
|---|---------|------------|-----|
| G1 | Chatbot NLP/LLM | ❌ | No hay modelo, no hay endpoint de NLP, no hay entrenamiento de intenciones |
| G2 | Integración WhatsApp Business API | ❌ | No hay webhook, no hay config de WhatsApp, no hay envío de mensajes |
| G3 | Interfaz de chat (agente) | ❌ | No hay página de chat en frontend |
| G4 | Historial de conversaciones | ❌ | No hay tablas, no hay endpoint, no hay UI |
| G5 | Métricas de IA | ❌ | No hay tablas, no hay cálculo, no hay dashboard |
| G6 | Sistema de intenciones | ❌ | No hay entrenamiento, no hay modelo, no hay storage |
| G7 | Plantillas de respuesta | ❌ | No hay templates, no hay variables dinámicas |
| G8 | Transferencia bot → agente | ❌ | No hay lógica de routing, no hay cola |
| G9 | Horario de atención | ❌ | No hay config, no hay lógica fuera de horario |
| G10 | Multi-idioma | ❌ | No hay soporte de idiomas en templates |

**Total de gaps: 10 features bloqueantes. Módulo completamente sin implementar.**

---

## 10. Checklist de verificación M06

### Backend
- [ ] Tabla `ai_conversations` creada y con datos de prueba
- [ ] Tabla `ai_messages` creada
- [ ] Tabla `ai_intents` con al menos 5 intenciones de ejemplo
- [ ] Tabla `ai_templates` con templates por categoría
- [ ] Tabla `ai_metrics_daily` con cálculo automático
- [ ] Tabla `ai_whatsapp_config` con config por hotel
- [ ] CRUD de intenciones (create/read/update/delete)
- [ ] CRUD de plantillas
- [ ] Crear conversación + agregar mensajes
- [ ] Transferir conversación de bot a agente
- [ ] Cerrar conversación + registrar satisfacción
- [ ] Endpoint de métricas (diarias/mensuales)
- [ ] Webhook WhatsApp verificado (firma HMAC)
- [ ] Envío de mensajes vía WhatsApp API
- [ ] Validación E2: conversación activa duplicada
- [ ] Validación E2: agente sin permiso
- [ ] Validación E2: WhatsApp duplicado
- [ ] Validación E2: intención de sistema no eliminable

### Frontend
- [ ] Página `/panel/ai/recepcionista` con sidebar de conversaciones + chat
- [ ] Página `/panel/ai/config` con CRUD de intenciones y plantillas
- [ ] Página `/panel/ai/conversations` con tabla histórica + filtros + export
- [ ] Página `/panel/ai/metrics` con KPIs + gráficas
- [ ] Modal `form` para crear/editar intenciones
- [ ] Modal `form` para configurar WhatsApp
- [ ] Modal `detail` para ver conversación completa
- [ ] Modal `confirm` para cerrar conversación
- [ ] Toast success en cada acción
- [ ] Toast error E1/E2/E6 con texto canónico
- [ ] Loading state (F6) en botones de acción
- [ ] Skeleton de carga en listas
- [ ] Estado vacío (F4): "Sin conversaciones activas"
- [ ] Notificación F5 cuando huésped necesita asesor

### Integración
- [ ] WhatsApp Business API conectada (sandbox de prueba)
- [ ] Mensaje entrante de WhatsApp crea conversación automática
- [ ] Respuesta del bot se envía por WhatsApp correctamente
- [ ] Variables dinámicas (`{guestName}`, `{roomNumber}`) se rellenan
- [ ] Horario de atención respeta config (fuera de horario → mensaje automático)

---

*Este documento sigue el molde de `M01-PMS-Central.md`. Módulo NO implementado — toda documentación es target/spec para desarrollo futuro.*
