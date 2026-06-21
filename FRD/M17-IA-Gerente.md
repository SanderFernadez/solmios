# FRD · M17 — Gerente Virtual con IA

> **Módulo NO implementado (target/spec).** Define el asistente virtual para el gerente del hotel — chatbot de análisis, reportes automatizados, alertas inteligentes, y recomendaciones ejecutivas. NO existe código en frontend ni backend — todo es especificación para desarrollo futuro.
>
> **Veredicto del módulo:** 🔴 No implementado. Sin backend, sin frontend, sin integraciones de LLM.

**Módulo:** M17 — Gerente Virtual con IA
**Pantallas cubiertas (target):** Asistente IA (`/panel/ai/gerente`) · Configuración de alertas (`/panel/ai/alerts`) · Reportes automatizados (`/panel/ai/reports`) · Historial de interacciones (`/panel/ai/history`)
**Servicios frontend (target):** `ManagerAI.service.ts`
**Servicios backend (target):** módulo `ai-manager` (LLM engine, alert engine, report scheduler)

---

## 1. Modelo de datos (target schema)

### 1.1 Interacciones con el asistente (`ai_manager_interactions`)

| Campo | Tipo | Reglas | Descripción |
|-------|------|--------|-------------|
| `id` | string | required, uuid | — |
| `userId` | string | required, FK → `users.id` | Gerente que hizo la pregunta |
| `hotelId` | string | indexed, multi-tenant | — |
| `query` | text | required | Pregunta del usuario en lenguaje natural |
| `response` | text | required | Respuesta generada por la IA |
| `queryType` | enum | nullable | `question` · `report_request` · `action_request` · `analysis` · `comparison` |
| `dataSourcesUsed` | json | nullable | Tablas/módulos consultados para responder |
| `confidence` | number | nullable, 0-1 | Confianza de la respuesta |
| `feedback` | enum | nullable | `helpful` · `not_helpful` · `inaccurate` |
| `createdAt` | datetime | required | — |
| `responseTimeMs` | number | nullable | Tiempo de generación |

### 1.2 Alertas configuradas (`ai_manager_alerts`)

| Campo | Tipo | Reglas | Descripción |
|-------|------|--------|-------------|
| `id` | string | required | — |
| `hotelId` | string | indexed | — |
| `name` | string | required | Nombre descriptivo de la alerta |
| `type` | enum | required | `threshold` · `trend` · `anomaly` · `schedule` · `event` |
| `metric` | string | required | Métrica a monitorear: `occupancy` · `adr` · `revpar` · `revenue` · `cancellations` · `competitor_price` · `guest_satisfaction` |
| `condition` | json | required | `{ operator: 'gt'|'lt'|'eq', value: N, period: 'daily'|'weekly' }` |
| `channels` | json | required | `["email", "whatsapp", "push", "in_app"]` |
| `recipients` | json | required, array | User IDs o emails |
| `active` | number | default 1 | — |
| `lastTriggeredAt` | nullable | — | Última vez que se disparó |
| `cooldownMinutes` | number | default 60 | Minutos entre alertas repetidas |

### 1.3 Historial de alertas disparadas (`ai_manager_alert_log`)

| Campo | Tipo | Reglas | Descripción |
|-------|------|--------|-------------|
| `id` | string | required | — |
| `alertId` | string | required, FK → `ai_manager_alerts.id` | Alerta padre |
| `hotelId` | string | indexed | — |
| `metricValue` | number | required | Valor de la métrica al momento de la alerta |
| `threshold` | number | required | Umbral que se cruzó |
| `message` | text | required | Mensaje de la alerta |
| `sentChannels` | json | required | Canales por donde se envió |
| `acknowledged` | number | default 0 | Si el gerente la leyó |
| `acknowledgedAt` | nullable | — | Cuándo la leyó |
| `createdAt` | datetime | required | — |

### 1.4 Reportes automatizados (`ai_manager_scheduled_reports`)

| Campo | Tipo | Reglas | Descripción |
|-------|------|--------|-------------|
| `id` | string | required | — |
| `hotelId` | string | indexed | — |
| `name` | string | required | Nombre del reporte |
| `type` | enum | required | `daily_summary` · `weekly_kpi` · `monthly_analysis` · `custom` |
| `metrics` | json | required, array | Métricas a incluir: `["occupancy", "revenue", "adr", "cancellations", "top_channels"]` |
| `schedule` | enum | required | `daily` · `weekly` · `monthly` |
| `dayOfWeek` | nullable | number 0-6 | Para reportes semanales |
| `dayOfMonth` | nullable | number 1-31 | Para reportes mensuales |
| `time` | string | required | Hora de envío: "08:00" |
| `channels` | json | required | Canales de envío |
| `recipients` | json | required, array | — |
| `active` | number | default 1 | — |
| `lastGeneratedAt` | nullable | — | — |
| `templateId` | nullable | FK → `ai_templates.id` | Plantilla del reporte |

### 1.5 Resúmenes diarios generados (`ai_manager_daily_digest`)

| Campo | Tipo | Reglas | Descripción |
|-------|------|--------|-------------|
| `id` | string | required | — |
| `hotelId` | string | indexed | — |
| `date` | date | required, unique(hotelId,date) | — |
| `summary` | text | required | Resumen en lenguaje natural generado por IA |
| `highlights` | json | required | Array de puntos clave: `[{ metric, value, change, direction }]` |
| `alerts` | json | nullable | Alertas activas del día |
| `recommendations` | json | nullable | Recomendaciones IA del día |
| `generatedAt` | datetime | required | — |

---

## 2. Pantalla — Asistente IA del Gerente (`/panel/ai/gerente`)

> ⚠ **NO implementado.** Toda esta sección es TARGET.

Interfaz tipo chat conversacional. El gerente hace preguntas sobre el negocio y la IA responde con datos reales del sistema.

### 2.1 Ejemplos de preguntas que el asistente debe poder responder

| Categoría | Pregunta ejemplo | Fuente de datos |
|-----------|-----------------|-----------------|
| **KPIs actuales** | "¿Cuál es la ocupación de hoy?" | `reservations` + `rooms` |
| **Comparativa** | "¿Cómo va esta semana vs la semana pasada?" | `reservations` (agrupado por semana) |
| **Revenue** | "¿Cuánto facturamos este mes?" | `reservations.totalAmount` (agrupado por mes) |
| **Top performers** | "¿Cuáles son las habitaciones más vendidas?" | `reservations` (GROUP BY roomId) |
| **Canales** | "¿De qué canal vienen más reservas?" | `reservations.source` |
| **Cancelaciones** | "¿Cuántas cancelaciones hubo esta semana?" | `reservations.status = cancelled` |
| **Huéspedes** | "¿Quiénes son los huéspedes frecuentes?" | `guests.totalStays > 1` |
| **Competencia** | "¿Cómo estamos vs el hotel X?" | `revenue_competitors` |
| **Pronóstico** | "¿Cómo será la demanda la próxima semana?" | `revenue_forecast` |
| **Acciones** | "Aumentá el precio de las suites un 10%" | `revenue_base_rates` (con confirmación) |

### 2.2 Decision Table

| Trigger | Condición | Resultado | Modal/Toast (texto literal) | Errores | Notif F5 |
|---------|-----------|-----------|------------------------------|---------|----------|
| Usuario escribe pregunta | `query.length > 0` | POST `/api/ai/manager/ask` → streaming de respuesta | — | E6 "El asistente no está disponible. Reintentá en unos segundos." | — |
| **"👍 Útil"** (debajo de respuesta) | respuesta generada | PATCH feedback `helpful` | Toast info: "Gracias por tu feedback." | — | — |
| **"👎 No útil"** | respuesta generada | PATCH feedback `not_helpful` | Toast info: "Feedback registrado. Mejoraremos la respuesta." | — | — |
| **"📊 Generar reporte de esto"** | respuesta con datos | Genera reporte formateado de la métrica consultada | — | E6 | — |
| **"📧 Enviar por email"** | respuesta generada | Abre modal: destinatarios, formato | Modal `form`: "Enviar resumen por email" | — | — |
| **"🔔 Crear alerta para esto"** | respuesta sobre una métrica | Abre modal prellenado con la métrica de la pregunta | Modal `form`: "Crear Alerta" | — | — |
| **"📈 Ver tendencia"** | respuesta con valor puntual | Abre gráfica de tendencia de la métrica (30 días) | — | — | — |
| **Sugerencia de acciones** | IA detecta oportunidad | Muestra botones: "Aplicar", "Ver más detalles", "Descartar" | — | — | — |
| Botón **"🗑 Limpiar historial"** | — | Modal danger: "¿Borrar historial de conversaciones?" | Toast success: "Historial limpiado." | E6 | — |

### 2.3 Flow — Consulta del gerente → respuesta IA

```mermaid
flowchart TD
    A([Gerente escribe pregunta]) --> B[POST /api/ai/manager/ask]
    B --> C[Backend: parsea intención]
    C --> D{¿Qué datos necesita?}
    D -- KPIs --> E[Consulta composition-root: /api/dashboard]
    D -- Reservas --> F[Consulta reservations + rooms]
    D -- Revenue --> G[Consulta reservations + folios]
    D -- Competidores --> H[Consulta revenue_competitors]
    D -- Forecast --> I[Consulta revenue_forecast]
    D -- Acción --> J[Valida permisos del usuario]
    E --> K[Enriquece datos con contexto temporal]
    F --> K
    G --> K
    H --> K
    I --> K
    J --> K
    K --> L[LLM genera respuesta en lenguaje natural]
    L --> M{¿Acción solicitada?}
    M -- no --> N[Responde con datos + gráfica inline]
    M -- sí, consulta --> O[Responde + botón "Aplicar"]
    M -- sí, cambio de precio --> P[Modal warning: '¿Confirmar cambio de precio?']
    P --> Q{Confirmar?}
    Q -- sí --> R[Ejecuta acción en módulo correspondiente]
    R --> S[Toast success: 'Acción ejecutada.']
    Q -- no --> T[Cancelado]
    N --> U[Registra en ai_manager_interactions]
    S --> U
    T --> U
```

### 2.4 Ejemplo de interacción (target)

```
Gerente: ¿Cómo va la ocupación esta semana?

Asistente: 📊 La ocupación de esta semana va al 78%, lo cual es
+5% mejor que la semana pasada (73%).

亮点 Highlights:
• Jueves y viernes están al 95% — casi llenos
• Martes y miércoles bajan a 60% — oportunidad de promociones
• Canal principal: Booking.com (42% de reservas)
• ADR promedio: $145 (+$8 vs semana pasada)

💡 Recomendación: Activar una promoción de midweek para subir
la ocupación de martes/miércoles.

[🔔 Crear alerta] [📈 Ver tendencia] [📧 Enviar reporte]
```

---

## 3. Pantalla — Configuración de Alertas (`/panel/ai/alerts`)

> ⚠ **TARGET.** No implementado.

CRUD de alertas automáticas que notifican al gerente cuando ciertas métricas cruzan umbrales.

### 3.1 Decision Table

| Trigger | Condición | Resultado | Modal/Toast (texto) | Errores | Notif F5 |
|---------|-----------|-----------|----------------------|---------|----------|
| **"+ Nueva Alerta"** | — | Abre modal form con tipos de métrica disponibles | Modal `form`: "Nueva Alerta" | — | — |
| **"Guardar Alerta"** | nombre + métrica + condición + canales presentes | POST `/api/ai/manager/alerts` | Toast success: "Alerta '{nombre}' creada." | E1 "Faltan campos obligatorios" · E6 | — |
| Editar alerta existente | — | Abre modal form precargado | Modal `form`: "Editar Alerta" | — | — |
| Toggle **"Activa/Inactiva"** | — | PATCH `active` | — | E6 | — |
| **"Eliminar"** alerta | — | Modal danger: "¿Eliminar alerta '{nombre}'?" | Toast success: "Alerta eliminada." | E6 | — |
| **"Probar alerta"** (botón test) | — | Simula la condición y envía notificación de prueba | Toast info: "Notificación de prueba enviada a {canales}." | E6 | — |
| **"Ver historial de disparos"** (en fila) | — | Abre modal detail: lista de veces que se disparó, timestamps | Modal `detail` | — | — |
| **"Limpiar historial"** (en historial) | — | Modal danger: "¿Borrar historial de esta alerta?" | Toast success: "Historial limpiado." | E6 | — |

### 3.2 Tipos de alerta disponibles

| Tipo de alerta | Condición ejemplo | Métrica | Operadores |
|----------------|-------------------|---------|------------|
| **Umbral** | Ocupación < 50% | `occupancy` | `gt`, `lt`, `eq`, `gte`, `lte` |
| **Tendencia** | Revenue cae 3 días seguidos | `revenue` | `streak_down`, `streak_up` |
| **Anomalía** | Cancelaciones > 2σ del promedio | `cancellations` | `anomaly_high`, `anomaly_low` |
| **Programada** | Reporte diario a las 8am | — | `daily`, `weekly`, `monthly` |
| **Evento** | Reserva de último minuto > N | `last_minute_bookings` | `gt` |

### 3.3 Flow — Alerta automática

```mermaid
flowchart TD
    A([Cron job: cada 15 min]) --> B[Para cada alerta activa]
    B --> C[Consulta métrica actual]
    C --> D{¿Condición cumplida?}
    D -- no --> E[Skip]
    D -- sí --> F{¿Cooldown respetado?}
    F -- no --> E
    F -- sí --> G[Genera mensaje: 'Alerta: {nombre} — {métrica} = {valor}']
    G --> H[Envía por canales configurados]
    H --> I[Registra en ai_manager_alert_log]
    I --> J[Actualiza lastTriggeredAt]
    E --> K[Siguiente alerta]
```

---

## 4. Pantalla — Reportes Automatizados (`/panel/ai/reports`)

> ⚠ **TARGET.** No implementado.

Configuración de reportes que se generan y envían automáticamente.

### 4.1 Decision Table

| Trigger | Condición | Resultado | Modal/Toast (texto) | Errores | Notif F5 |
|---------|-----------|-----------|----------------------|---------|----------|
| **"+ Nuevo Reporte"** | — | Abre modal form: nombre, tipo, métricas, schedule, canales | Modal `form`: "Nuevo Reporte Automatizado" | — | — |
| **"Guardar Reporte"** | nombre + métricas + schedule presentes | POST `/api/ai/manager/reports/scheduled` | Toast success: "Reporte '{nombre}' configurado." | E1 · E6 | — |
| **"📧 Enviar ahora"** (en fila) | — | Genera y envía reporte inmediatamente | Loading → Toast success: "Reporte enviado a {n} destinatarios." | E6 "No se pudo generar el reporte" | — |
| **"👁 Previsualizar"** (en fila) | — | Genera el reporte y lo muestra en modal | Modal `detail` | — | — |
| Toggle **"Activo/Inactivo"** | — | PATCH `active` | — | E6 | — |
| **"Eliminar"** | — | Modal danger: "¿Eliminar reporte '{nombre}'?" | Toast success: "Reporte eliminado." | E6 | — |
| **"Ver envíos anteriores"** | — | Abre tabla con historial de envíos | — | — | — |

### 4.2 Plantillas de reporte disponibles

| Plantilla | Contenido | Frecuencia típica |
|-----------|-----------|-------------------|
| **Resumen Diario** | Ocupación, revenue, ADR, llegadas, salidas, incidencias | Diario 8:00am |
| **KPIs Semanales** | 7 días: ocupación, revenue, ADR, RevPAR, comparativa vs semana anterior | Lunes 9:00am |
| **Análisis Mensual** | Análisis completo: tendencias, canales, huéspedes, competidores, forecast | 1ro del mes 9:00am |
| **Alerta de Overbooking** | Lista de overbookings potenciales, acciones tomadas | Bajo demanda |
| **Performance por Canal** | Revenue y ocupación por fuente de reserva | Semanal |
| **Satisfacción del Huésped** | Ratings, reviews, NPS, quejas recurrentes | Semanal |

---

## 5. Pantalla — Historial de Interacciones (`/panel/ai/history`)

> ⚠ **TARGET.** No implementado.

Log completo de todas las preguntas hechas al asistente y sus respuestas.

### 5.1 Decision Table

| Trigger | Condición | Resultado | Modal/Toast (texto) | Errores | Notif F5 |
|---------|-----------|-----------|----------------------|---------|----------|
| Cargar página | — | GET `/api/ai/manager/interactions` → tabla paginada | — | E6 | — |
| Filtros (fecha, tipo, usuario, satisfacción) | — | Filtra tabla | — | — | — |
| **"📥 Exportar"** | — | Genera CSV de interacciones | Toast success: "Exportación descargada." | E6 | — |
| Clic en fila | — | Abre **modal detail**: pregunta completa, respuesta, fuentes, tiempo | Modal `detail` | — | — |
| **"🔄 Rehacer pregunta"** (en detail) | — | Reenvía la misma pregunta al asistente (datos actualizados) | — | E6 | — |
| **"📊 Ver métricas de uso"** (pestaña) | — | Gráficas: preguntas por día, tipos más frecuentes, satisfacción promedio | — | — | — |

---

## 6. Endpoints target (backend)

| Método | Ruta | Rol | Descripción | ¿Implementado? |
|--------|------|-----|-------------|----------------|
| POST | `/api/ai/manager/ask` | hotel_admin | Pregunta al asistente (streaming) | ❌ no implementado |
| GET | `/api/ai/manager/interactions` | hotel_admin | Historial de interacciones | ❌ no implementado |
| PATCH | `/api/ai/manager/interactions/:id/feedback` | hotel_admin | Feedback (helpful/not) | ❌ no implementado |
| GET | `/api/ai/manager/digest` | hotel_admin | Resumen diario | ❌ no implementado |
| POST | `/api/ai/manager/digest/generate` | hotel_admin | Generar digest del día | ❌ no implementado |
| GET | `/api/ai/manager/alerts` | hotel_admin | Listar alertas configuradas | ❌ no implementado |
| POST | `/api/ai/manager/alerts` | hotel_admin | Crear alerta | ❌ no implementado |
| PUT | `/api/ai/manager/alerts/:id` | hotel_admin | Editar alerta | ❌ no implementado |
| DELETE | `/api/ai/manager/alerts/:id` | hotel_admin | Eliminar alerta | ❌ no implementado |
| POST | `/api/ai/manager/alerts/:id/test` | hotel_admin | Probar alerta | ❌ no implementado |
| GET | `/api/ai/manager/alerts/:id/log` | hotel_admin | Historial de disparos | ❌ no implementado |
| GET | `/api/ai/manager/reports/scheduled` | hotel_admin | Listar reportes programados | ❌ no implementado |
| POST | `/api/ai/manager/reports/scheduled` | hotel_admin | Crear reporte programado | ❌ no implementado |
| PUT | `/api/ai/manager/reports/scheduled/:id` | hotel_admin | Editar reporte | ❌ no implementado |
| DELETE | `/api/ai/manager/reports/scheduled/:id` | hotel_admin | Eliminar reporte | ❌ no implementado |
| POST | `/api/ai/manager/reports/scheduled/:id/send` | hotel_admin | Enviar reporte ahora | ❌ no implementado |
| GET | `/api/ai/manager/reports/scheduled/:id/preview` | hotel_admin | Previsualizar reporte | ❌ no implementado |
| POST | `/api/ai/manager/alerts/check` | cron/super_admin | Verificar todas las alertas | ❌ no implementado |
| POST | `/api/ai/manager/digest/aggregate` | cron/super_admin | Generar digest para todos los hoteles | ❌ no implementado |

---

## 7. Consecuencias cross-módulo (eventos que dispara M17)

| Acción en M17 | Módulo afectado | Efecto | Estado |
|---------------|-----------------|--------|--------|
| Gerente pide "aumentar precio X%" | M12 — Revenue Manager | Ejecuta cambio de tarifa (con confirmación) | ❌ target |
| Gerente pide "verificar competidores" | M12 — Revenue Manager | Ejecuta scraping de precios | ❌ target |
| Gerente pide "reporte de ocupación" | M16 — BI | Genera reporte desde datos de M01 | ❌ target |
| Alerta de umbrales se dispara | Notificaciones (M-notif) | Envía por email/WhatsApp/push | ❌ target |
| Reporte diario se genera | Email/WhatsApp | Envía digest al gerente | ❌ target |
| Digest diario se genera | M16 — BI | Lee KPIs del dashboard | ❌ target |
| IA detecta anomalía | M12 — Revenue | Recomienda ajuste de precios | ❌ target |
| IA detecta overbooking potencial | M01 — PMS Central | Bloquea reservas, notifica admin | ❌ target |

---

## 8. Reglas de negocio (E2)

| # | Regla | Texto canónico | ¿Implementada? |
|---|-------|----------------|----------------|
| 1 | **Pregunta sin contexto suficiente** | "No tengo suficiente información para responder eso. Intentá reformular la pregunta." | ❌ target |
| 2 | **Acción solicitada sin permiso** | "No tenés permiso para ejecutar esta acción. Solicitá acceso a un administrador." | ❌ target |
| 3 | **Cambio de precio sin confirmación** | "¿Confirmás cambiar el precio de {tipo} de ${old} a ${new}?" (modal warning) | ❌ target |
| 4 | **Alerta duplicada en cooldown** | (silencioso — no envía, espera cooldown) | ❌ target |
| 5 | **Reporte sin datos** | "No hay datos suficientes para generar este reporte. Verificá la configuración." | ❌ target |
| 6 | **Digest ya generado hoy** | "El resumen de hoy ya fue generado. ¿Regenerarlo?" | ❌ target |
| 7 | **Máximo 50 interacciones por día** | "Llegaste al límite de 50 consultas diarias. Intentá mañana." | ❌ target |
| 8 | **Modelo IA no disponible** | "El servicio de IA no está disponible temporalmente. Reintentá en unos minutos." | ❌ target |

---

## 9. Gap analysis

| # | Feature | Existe hoy | Gap |
|---|---------|------------|-----|
| G1 | Chat conversacional con datos reales | ❌ | No hay endpoint de LLM, no hay integración OpenAI/similar |
| G2 | Resúmenes diarios automatizados | ❌ | No hay tabla de digests, no hay generación automática |
| G3 | Alertas configurables por métrica | ❌ | No hay tablas de alertas, no hay cron de verificación |
| G4 | Reportes automatizados programados | ❌ | No hay scheduler, no hay generación de reportes |
| G5 | Historial de interacciones | ❌ | No hay tabla, no hay UI |
| G6 | Feedback del usuario (helpful/not) | ❌ | No hay campo en tabla, no hay botones en UI |
| G7 | Streaming de respuestas (SSE) | ❌ | No hay soporte de streaming en backend |
| G8 | Sugerencias de acciones ejecutables | ❌ | No hay lógica de acción desde chat |
| G9 | Notificaciones multi-canal (email/WhatsApp/push) | ❌ | No hay integración de envío masivo |
| G10 | Análisis de tendencias y anomalías | ❌ | No hay modelo de detección de anomalías |

**Total de gaps: 10 features bloqueantes. Módulo completamente sin implementar.**

---

## 10. Checklist de verificación M17

### Backend
- [ ] Tabla `ai_manager_interactions` creada
- [ ] Tabla `ai_manager_alerts` con al menos 5 alertas de ejemplo
- [ ] Tabla `ai_manager_alert_log`
- [ ] Tabla `ai_manager_scheduled_reports` con 3 reportes ejemplo
- [ ] Tabla `ai_manager_daily_digest` con digest de ejemplo
- [ ] Endpoint `/api/ai/manager/ask` con streaming SSE
- [ ] Integración con LLM (OpenAI/similar) funcional
- [ ] CRUD de alertas configurables
- [ ] Cron de verificación de alertas (cada 15 min)
- [ ] CRUD de reportes programados
- [ ] Generación automática de digest diario
- [ ] Envío de reportes por email
- [ ] Validación E2: pregunta sin contexto
- [ ] Validación E2: cambio de precio sin confirmación
- [ ] Validación E2: límite de consultas diarias
- [ ] Validación E2: modelo IA no disponible

### Frontend
- [ ] Página `/panel/ai/gerente` con interfaz tipo chat
- [ ] Página `/panel/ai/alerts` con CRUD de alertas
- [ ] Página `/panel/ai/reports` con reportes programados
- [ ] Página `/panel/ai/history` con tabla de interacciones
- [ ] Modal `form` para crear/editar alertas
- [ ] Modal `form` para crear reportes programados
- [ ] Modal `warning` antes de ejecutar acciones de precio
- [ ] Modal `detail` de interacción completa
- [ ] Streaming de respuesta (texto aparece gradualmente)
- [ ] Botones de feedback (👍/👎) bajo cada respuesta
- [ ] Botones de acción: "Crear alerta", "Ver tendencia", "Enviar reporte"
- [ ] Toast success en cada acción
- [ ] Toast error E1/E2/E6 con texto canónico
- [ ] Loading state (F6) durante generación de respuesta
- [ ] Skeleton de carga en listas
- [ ] Estado vacío (F4): "Preguntale algo a tu asistente IA"

### Integración
- [ ] LLM responde con datos reales del hotel (no inventa números)
- [ ] Alertas se disparan correctamente cuando se cruza umbral
- [ ] Reportes se generan con datos actualizados
- [ ] Digest se genera automáticamente todos los días
- [ ] Cambios de precio desde chat se reflejan en M12
- [ ] Notificaciones llegan por email/WhatsApp según config

---

*Este documento sigue el molde de `M01-PMS-Central.md`. Módulo NO implementado — toda documentación es target/spec para desarrollo futuro.*
