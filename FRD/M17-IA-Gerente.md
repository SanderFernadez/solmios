# FRD · M17 — Gerente Virtual con IA (Agente de Control Total)

> **Módulo IMPLEMENTADO (backend partial) / EN EVOLUCIÓN.** Define el agente IA que actúa como **manos digitales del dueño del hotel** — ejecuta acciones en todos los módulos del sistema mediante lenguaje natural. NO es un asistente pasivo de consulta. Es un **agente ejecutor** con tools que CREAN, EDITAN, ELIMINAN y EJECUTAN operaciones en cada módulo.
>
> **Restricción:** Solo accesible por rol `hotel_admin` (el dueño del hotel). NADA de super_admin.

**Módulo:** M17 — Gerente Virtual con IA
**Pantallas:** Chat del dueño (`/panel/ai/gerente`) · Historial de acciones (`/panel/ai/history`)
**Servicios frontend:** `AiGerente.service.ts`
**Servicios backend:** `ai-gerente/` (LLM pipeline + 55 tools de ejecución)

---

## 1. Visión

El dueño del hotel le habla al sistema como si fuera su gerente:

```
Dueño: "Creá reserva para Juan Pérez del 5 al 8 de julio, habitación 12,
        poné la suite 5 en mantenimiento, y ejecutá el night audit de hoy"
                          ↓
    ┌─────────────────────────────────────────────────────────┐
    │  POST /api/ai/manager/ask  +  mensaje en lenguaje natural │
    └────────────────────────┬────────────────────────────────┘
                             ↓
      LLM interpreta intención → decide qué tools llamar
                             ↓
    ┌──────────┐  ┌────────────┐  ┌────────────────┐
    │create_res│  │block_room  │  │exec_night_audit│
    │(reserva) │  │(suite 5)   │  │(hoy)           │
    └──────────┘  └────────────┘  └────────────────┘
                             ↓
          Cada tool ejecuta contra el endpoint real del sistema
```

Diferencia clave con la Recepcionista IA (M06):

| Aspecto | M06 Recepcionista | M17 Gerente Virtual |
|---------|------------------|-------------------|
| **Habla con** | Huéspedes | Dueño del hotel |
| **Rol** | `receptionist` | `hotel_admin` |
| **Tools** | 11 (consulta disponibilidad, reservar, FAQ, escalar) | ~55 (CREAR, EDITAR, ELIMINAR en todos los módulos) |
| **Acción** | Consultar y crear reservas | Control total del sistema |
| **Confirmación** | No requiere | Acciones destructivas requieren `confirmed:true` |

---

## 2. Modelo de datos

### 2.1 Interacciones (`ai_manager_interactions`) ✅ EXISTE

| Campo | Tipo | Reglas |
|-------|------|--------|
| `id` | string | required, uuid |
| `hotelId` | string | indexed, multi-tenant |
| `query` | text | required — pregunta del dueño |
| `response` | text | required — respuesta generada |
| `toolsCalled` | json | nullable — `[{ tool: string, args: {}, result: {} }]` |
| `confidence` | number | nullable, 0-1 |
| `feedback` | enum | nullable: `helpful` · `not_helpful` · `inaccurate` |
| `responseTimeMs` | number | nullable |
| `createdAt` | datetime | required |

### 2.2 Tools disponibles por módulo (`ai_manager_tool_registry`)

| Campo | Tipo | Reglas |
|-------|------|--------|
| `id` | string | required |
| `module` | string | required — ej: `reservas`, `facturas`, `housekeeping` |
| `toolName` | string | required — única |
| `description` | text | required |
| `parameters` | json | required — JSON schema |
| `destructive` | number | default 0 — si requiere `confirmed:true` |
| `active` | number | default 1 |

---

## 3. Tools del Gerente (~55, organizadas por módulo)

### 3.1 Reservas y Huéspedes ✅ 8 Existente + 3 Nuevas

| Tool | Descripción | Destructiva |
|------|-------------|:-----------:|
| `search_availability` | Buscar habitaciones libres en rango de fechas | ❌ |
| `create_reservation` | Crear reserva (asigna habitación automáticamente) | ❌ |
| `cancel_reservation` | Cancelar una reserva | ✅ requiere confirmación |
| `checkin_guest` | Hacer check-in de una reserva | ❌ |
| `checkout_guest` | Hacer check-out de una reserva | ❌ |
| `list_arrivals` | Listar llegadas de una fecha | ❌ |
| `list_departures` | Listar salidas de una fecha | ❌ |
| `block_room` | Bloquear habitación (mantenimiento/cierre) | ✅ requiere confirmación |
| `adjust_room_rate` | Ajustar precio base por delta porcentual | ✅ requiere confirmación |
| `search_guest` | Buscar huésped por nombre/email/teléfono | ❌ |
| `create_guest` | Crear un nuevo huésped | ❌ |
| `update_guest` | Actualizar datos del huésped | ❌ |
| `get_guest_history` | Ver historial de estadías del huésped | ❌ |

### 3.2 Habitaciones

| Tool | Descripción | Destructiva |
|------|-------------|:-----------:|
| `list_rooms` | Listar todas las habitaciones del hotel | ❌ |
| `get_room` | Ver detalle de una habitación | ❌ |
| `update_room_status` | Cambiar estado (disponible/ocupada/limpieza/mantenimiento) | ❌ |
| `update_room` | Actualizar datos de la habitación | ❌ |
| `bulk_update_rates` | Actualizar tarifas de múltiples habitaciones | ✅ requiere confirmación |

### 3.3 Facturación y Pagos

| Tool | Descripción | Destructiva |
|------|-------------|:-----------:|
| `create_invoice` | Generar factura para una reserva con items | ❌ |
| `pay_invoice` | Registrar pago de factura (parcial/total) | ❌ |
| `email_invoice` | Enviar factura por email al huésped | ❌ |
| `credit_note` | Generar nota de crédito (cancelar + abonar) | ✅ requiere confirmación |
| `get_tax_report` | Obtener reporte fiscal de un período | ❌ |
| `get_invoice_stats` | Estadísticas de facturación | ❌ |
| `charge_card` | Cobrar tarjeta directamente | ✅ requiere confirmación |
| `refund_payment` | Reembolsar un pago | ✅ requiere confirmación |
| `create_payment_link` | Generar link de pago para enviar al huésped | ❌ |
| `create_deposit` | Crear depósito (pre-autorización) | ❌ |
| `release_deposit` | Liberar depósito | ❌ |
| `open_folio` | Abrir folio para una reserva | ❌ |
| `close_folio` | Cerrar folio y facturar | ❌ |
| `post_folio_charge` | Agregar cargo al folio (minibar, servicio, etc.) | ❌ |

### 3.4 Housekeeping y Mantenimiento

| Tool | Descripción | Destructiva |
|------|-------------|:-----------:|
| `get_cleaning_status` | Ver estado de limpieza de todas las habitaciones | ❌ |
| `assign_cleaning` | Asignar tarea de limpieza a un empleado | ❌ |
| `complete_cleaning` | Marcar limpieza como completada | ❌ |
| `get_cleaning_stats` | Estadísticas del equipo de limpieza | ❌ |
| `create_maintenance_ticket` | Crear orden de mantenimiento | ❌ |
| `complete_maintenance_ticket` | Completar orden de mantenimiento | ❌ |
| `get_open_maintenance_tickets` | Listar mantenimientos abiertos | ❌ |
| `get_maintenance_stats` | Estadísticas de mantenimiento | ❌ |

### 3.5 Night Audit y Operaciones

| Tool | Descripción | Destructiva |
|------|-------------|:-----------:|
| `execute_night_audit` | Ejecutar cierre de noche completo | ✅ requiere confirmación |
| `mark_no_shows` | Marcar no-show de reservas que no llegaron | ✅ requiere confirmación |
| `post_room_charges` | Publicar cargos de habitación de la noche | ❌ |
| `get_night_audit_status` | Ver estado del night audit de hoy | ❌ |

### 3.6 Channels (Channex)

| Tool | Descripción | Destructiva |
|------|-------------|:-----------:|
| `sync_channex` | Sincronizar propiedades + tarifas con Channex | ❌ |
| `ingest_ota_bookings` | Importar reservas de OTAs desde Channex | ❌ |
| `get_channel_metrics` | Ver métricas por canal (Booking, Airbnb, etc.) | ❌ |
| `get_sync_log` | Ver historial de sincronización | ❌ |

### 3.7 Pricing y Temporadas

| Tool | Descripción | Destructiva |
|------|-------------|:-----------:|
| `update_seasons` | Actualizar temporadas y precios | ✅ requiere confirmación |
| `copy_rates_next_year` | Copiar tarifas al próximo año | ✅ requiere confirmación |
| `set_room_blocks` | Bloquear disponibilidad por fechas | ✅ requiere confirmación |
| `update_rate_restrictions` | Actualizar restricciones (minStay, maxStay, etc.) | ✅ requiere confirmación |
| `get_channel_metrics` | Ver rendimiento por canal de venta | ❌ |

### 3.8 Caja

| Tool | Descripción | Destructiva |
|------|-------------|:-----------:|
| `open_shift` | Abrir turno de caja | ❌ |
| `close_shift` | Cerrar turno de caja | ❌ |
| `get_caja_movements` | Ver movimientos de caja de un período | ❌ |
| `get_caja_stats` | Estadísticas de caja | ❌ |

### 3.9 Empleados y Payroll

| Tool | Descripción | Destructiva |
|------|-------------|:-----------:|
| `list_staff` | Listar empleados del hotel | ❌ |
| `create_employee` | Dar de alta un empleado | ❌ |
| `update_employee` | Actualizar datos del empleado | ❌ |
| `deactivate_employee` | Dar de baja un empleado | ✅ requiere confirmación |
| `get_attendance_report` | Reporte de asistencia de un período | ❌ |
| `create_payroll_run` | Iniciar corrida de nómina | ✅ requiere confirmación |
| `approve_payroll` | Aprobar nómina para pago | ✅ requiere confirmación |
| `get_payroll_summary` | Resumen de nómina del período | ❌ |

### 3.10 Marketing y CRM

| Tool | Descripción | Destructiva |
|------|-------------|:-----------:|
| `create_auto_message` | Crear regla de mensaje automático | ❌ |
| `update_auto_message` | Actualizar regla de mensaje automático | ❌ |
| `delete_auto_message` | Eliminar regla de mensaje automático | ✅ requiere confirmación |
| `award_loyalty_points` | Otorgar puntos de fidelidad a un huésped | ❌ |
| `create_coupon` | Crear cupón de descuento | ❌ |
| `get_crm_dashboard` | Ver dashboard de CRM y loyalty | ❌ |
| `get_guest_ltv` | Calcular lifetime value de un huésped | ❌ |

### 3.11 TTLock (Cerraduras Inteligentes)

| Tool | Descripción | Destructiva |
|------|-------------|:-----------:|
| `sync_locks` | Sincronizar cerraduras TTLock | ❌ |
| `generate_room_code` | Generar código de acceso para una reserva | ❌ |
| `revoke_lock_code` | Revocar código de acceso | ✅ requiere confirmación |
| `get_lock_status` | Ver estado de las cerraduras | ❌ |

### 3.12 Reportes y Dashboard

| Tool | Descripción | Destructiva |
|------|-------------|:-----------:|
| `get_dashboard` | Obtener dashboard completo del hotel | ❌ |
| `get_occupancy_report` | Reporte de ocupación por período | ❌ |
| `get_revenue_report` | Reporte de ingresos por período | ❌ |
| `export_report` | Exportar reporte (CSV/PDF) | ❌ |

### 3.13 Configuración del Hotel

| Tool | Descripción | Destructiva |
|------|-------------|:-----------:|
| `get_hotel_settings` | Ver configuración actual del hotel | ❌ |
| `update_hotel_settings` | Actualizar settings del hotel | ✅ requiere confirmación |
| `update_taxes` | Actualizar configuración de impuestos | ✅ requiere confirmación |
| `update_policies` | Actualizar políticas del hotel | ❌ |
| `get_config` | Obtener valor de configuración por key | ❌ |
| `set_config` | Establecer valor de configuración | ❌ |

---

## 4. Modos de Operación

| Modo | Comportamiento | Uso |
|------|---------------|-----|
| **Manual** | La IA solo responde preguntas sobre datos, NO ejecuta acciones | Dueño quiere consultar sin riesgo |
| **Suggest** | La IA sugiere acciones pero pide confirmación antes de ejecutar | Modo por defecto — seguro |
| **Autopilot** | La IA ejecuta acciones automáticamente según reglas y thresholds | Dueño confía en la IA |

Las acciones destructivas SIEMPRE requieren `confirmed:true` independientemente del modo.

---

## 5. Endpoints

| Método | Ruta | Rol | Descripción | Estado |
|--------|------|-----|-------------|--------|
| POST | `/api/ai/manager/ask` | hotel_admin | Enviar mensaje al gerente IA (ejecuta tools) | ✅ Implementado |
| GET | `/api/ai/manager/interactions` | hotel_admin | Historial de interacciones | ✅ Implementado |
| PATCH | `/api/ai/manager/interactions/:id/feedback` | hotel_admin | Feedback (helpful/not/inaccurate) | ✅ Implementado |
| GET | `/api/ai/manager/tools` | hotel_admin | Listar tools disponibles del hotel | ❌ |
| POST | `/api/ai/manager/mode` | hotel_admin | Cambiar modo (manual/suggest/autopilot) | ❌ |
| GET | `/api/ai/manager/mode` | hotel_admin | Ver modo actual | ❌ |

---

## 6. Reglas de Negocio

| # | Regla | Texto |
|---|-------|-------|
| 1 | **Solo hotel_admin** | Solo el dueño del hotel puede hablar con el Gerente Virtual |
| 2 | **Acción destructiva requiere confirmación** | "¿Confirmás cancelar la reserva de Juan Pérez?" |
| 3 | **No inventa datos** | Todas las respuestas se basan en tools ejecutadas contra el sistema real |
| 4 | **Modo manual = consulta solamente** | En modo manual, las tools destructivas devuelven error |
| 5 | **Bypass de permisos** | El Gerente Virtual tiene permisos de hotel_admin — puede hacer todo lo que haría el dueño |
| 6 | **Máximo 4 iteraciones de tools** | El loop LLM-tool ejecuta máximo 4 ciclos para evitar loops infinitos |
| 7 | **Audit trail** | Cada tool ejecutada queda registrada en `ai_manager_interactions.toolsCalled` |

---

## 7. Gap Analysis

| # | Feature | Backend | Frontend |
|---|---------|---------|----------|
| G1 | 8 tools de reservas/habitaciones | ✅ Implementado | ❌ Sin frontend |
| G2 | ~47 tools restantes (facturas, HK, audit, etc.) | ❌ No implementado | ❌ Sin frontend |
| G3 | Chat conversacional para el dueño | ❌ No implementado | ❌ Sin frontend |
| G4 | Modos manual/suggest/autopilot | ❌ No implementado | ❌ Sin frontend |
| G5 | Streaming de respuesta (SSE) | ❌ No implementado | ❌ Sin frontend |
| G6 | Feedback (helpful/not) | ✅ Implementado | ❌ Sin frontend |

---

## 8. Checklist

### Backend
- [ ] ~55 tools implementadas en `usecases/tools.ts`
- [ ] Cada tool llama al endpoint REST correspondiente
- [ ] Acciones destructivas validan `confirmed:true`
- [ ] Modo manual bloquea ejecución de tools
- [ ] Endpoint GET `/api/ai/manager/tools`
- [ ] Endpoint POST/GET `/api/ai/manager/mode`
- [ ] Audit trail completo de cada tool ejecutada

### Frontend
- [ ] Página `/panel/ai/gerente` con interfaz tipo chat
- [ ] Historial de interacciones con tools ejecutadas
- [ ] Botones de feedback (👍/👎) bajo cada respuesta
- [ ] Selector de modo (manual/suggest/autopilot)
- [ ] Loading state durante ejecución de tools
- [ ] Estado vacío: "Decile algo a tu gerente virtual"

---

*Documento actualizado para reflejar el nuevo scope: Gerente Virtual como agente de control total del sistema hotelero (rol hotel_admin).*
