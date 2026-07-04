# SPEC — M17: Gerente Virtual con IA (Agente de Control Total) ⭐

**Suite**: Inteligencia Artificial
**Prioridad**: P1
**Complejidad**: Alta
**Destacado**: ★ Módulo estrella — el dueño controla TODO el hotel con lenguaje natural
**Rol**: `hotel_admin` (SOLO dueño del hotel, NO recepcionista, NO super_admin)

---

## Descripción

Agente IA que actúa como las **manos digitales del dueño del hotel**. El dueño escribe en lenguaje natural lo que necesita y el sistema ejecuta las acciones reales en los módulos correspondientes. NO es un chatbot de consulta — es un **agente ejecutor** con ~55 tools que atraviesan todos los módulos del sistema.

**Diferencia con M06 (Recepcionista Virtual):**
- M06 habla con **huéspedes** (reservas, preguntas, FAQ)
- M17 habla con el **dueño** (control total del hotel: crear, editar, eliminar, ejecutar)

---

## Funcionalidades

### 1. Chat Ejecutor por Lenguaje Natural
- El dueño escribe: *"Creá reserva para Pérez del 5 al 8, suite 3, y poné la 5 en mantenimiento"*
- El LLM interpreta → ejecuta tools → devuelve resultado
- Máximo 4 iteraciones LLM-tool por mensaje

### 2. Tools de Control Total (~55)

#### Módulo: Reservas y Huéspedes
| Tool | Descripción | ¿Destructiva? |
|------|-------------|:-------------:|
| `search_availability` | Buscar habitaciones libres en un rango | ❌ |
| `create_reservation` | Crear reserva (auto-asigna habitación) | ❌ |
| `cancel_reservation` | Cancelar | ✅ requiere confirmación |
| `checkin_guest` | Check-in (status → checked_in) | ❌ |
| `checkout_guest` | Check-out (status → checked_out) | ❌ |
| `list_arrivals` | Llegadas de una fecha | ❌ |
| `list_departures` | Salidas de una fecha | ❌ |
| `block_room` | Bloquear habitación | ✅ requiere confirmación |
| `adjust_room_rate` | Ajustar precio por delta % | ✅ requiere confirmación |
| `search_guest` | Buscar huésped | ❌ |
| `create_guest` | Crear huésped | ❌ |
| `update_guest` | Actualizar huésped | ❌ |
| `get_guest_history` | Historial del huésped | ❌ |

#### Módulo: Habitaciones
| Tool | Descripción | ¿Destructiva? |
|------|-------------|:-------------:|
| `list_rooms` | Listar habitaciones del hotel | ❌ |
| `get_room` | Detalle de una habitación | ❌ |
| `update_room_status` | Cambiar estado | ❌ |
| `update_room` | Actualizar datos | ❌ |
| `bulk_update_rates` | Actualizar tarifas múltiples | ✅ |

#### Módulo: Facturación y Pagos
| Tool | Descripción | ¿Destructiva? |
|------|-------------|:-------------:|
| `create_invoice` | Generar factura con items | ❌ |
| `pay_invoice` | Pagar factura | ❌ |
| `email_invoice` | Enviar por email | ❌ |
| `credit_note` | Nota de crédito | ✅ |
| `get_tax_report` | Reporte fiscal | ❌ |
| `charge_card` | Cobrar tarjeta | ✅ |
| `refund_payment` | Reembolsar | ✅ |
| `create_payment_link` | Link de pago | ❌ |
| `create_deposit` | Depósito | ❌ |
| `release_deposit` | Liberar depósito | ❌ |
| `open_folio` | Abrir folio | ❌ |
| `close_folio` | Cerrar folio | ❌ |
| `post_folio_charge` | Cargo al folio | ❌ |

#### Módulo: Housekeeping y Mantenimiento
| Tool | Descripción | ¿Destructiva? |
|------|-------------|:-------------:|
| `get_cleaning_status` | Estado de limpieza | ❌ |
| `assign_cleaning` | Asignar tarea | ❌ |
| `complete_cleaning` | Completar tarea | ❌ |
| `create_maintenance_ticket` | Orden de mantenimiento | ❌ |
| `complete_maintenance_ticket` | Cerrar orden | ❌ |
| `get_open_maintenance_tickets` | Órdenes abiertas | ❌ |

#### Módulo: Night Audit
| Tool | Descripción | ¿Destructiva? |
|------|-------------|:-------------:|
| `execute_night_audit` | Cierre de noche completo | ✅ |
| `mark_no_shows` | Marcar no-show | ✅ |
| `post_room_charges` | Cargos de habitación | ❌ |
| `get_night_audit_status` | Estado del audit | ❌ |

#### Módulo: Channels (Channex)
| Tool | Descripción | ¿Destructiva? |
|------|-------------|:-------------:|
| `sync_channex` | Sincronizar con Channex | ❌ |
| `ingest_ota_bookings` | Importar reservas OTA | ❌ |
| `get_channel_metrics` | Métricas por canal | ❌ |

#### Módulo: Pricing
| Tool | Descripción | ¿Destructiva? |
|------|-------------|:-------------:|
| `update_seasons` | Actualizar temporadas | ✅ |
| `copy_rates_next_year` | Copiar tarifas | ✅ |
| `set_room_blocks` | Bloquear disponibilidad | ✅ |
| `update_rate_restrictions` | Restricciones | ✅ |

#### Módulo: Caja
| Tool | Descripción | ¿Destructiva? |
|------|-------------|:-------------:|
| `open_shift` | Abrir turno | ❌ |
| `close_shift` | Cerrar turno | ❌ |
| `get_caja_movements` | Movimientos | ❌ |

#### Módulo: Empleados y Payroll
| Tool | Descripción | ¿Destructiva? |
|------|-------------|:-------------:|
| `list_staff` | Listar empleados | ❌ |
| `create_employee` | Dar de alta | ❌ |
| `deactivate_employee` | Dar de baja | ✅ |
| `get_attendance_report` | Reporte asistencia | ❌ |
| `create_payroll_run` | Corrida de nómina | ✅ |
| `approve_payroll` | Aprobar nómina | ✅ |

#### Módulo: Marketing y CRM
| Tool | Descripción | ¿Destructiva? |
|------|-------------|:-------------:|
| `create_auto_message` | Mensaje automático | ❌ |
| `award_loyalty_points` | Puntos de fidelidad | ❌ |
| `create_coupon` | Cupón de descuento | ❌ |
| `get_crm_dashboard` | Dashboard CRM | ❌ |

#### Módulo: TTLock
| Tool | Descripción | ¿Destructiva? |
|------|-------------|:-------------:|
| `sync_locks` | Sincronizar cerraduras | ❌ |
| `generate_room_code` | Código de acceso | ❌ |
| `revoke_lock_code` | Revocar código | ✅ |

#### Módulo: Reportes y Dashboard
| Tool | Descripción | ¿Destructiva? |
|------|-------------|:-------------:|
| `get_dashboard` | Dashboard completo | ❌ |
| `get_occupancy_report` | Reporte ocupación | ❌ |
| `get_revenue_report` | Reporte ingresos | ❌ |
| `export_report` | Exportar | ❌ |

#### Módulo: Configuración
| Tool | Descripción | ¿Destructiva? |
|------|-------------|:-------------:|
| `get_hotel_settings` | Settings actuales | ❌ |
| `update_hotel_settings` | Actualizar settings | ✅ |
| `update_taxes` | Impuestos | ✅ |
| `update_policies` | Políticas | ❌ |
| `get_config` | Config KV | ❌ |
| `set_config` | Config KV | ❌ |

### 3. Modos de Operación

| Modo | Comportamiento | Default |
|------|---------------|:-------:|
| **Manual** | Solo consulta — responde preguntas, NO ejecuta tools destructivas | ❌ |
| **Suggest** | Sugiere acciones y pide confirmación antes de ejecutar | ✅ |
| **Autopilot** | Ejecuta automáticamente según reglas configuradas | ❌ |

Independientemente del modo, las tools marcadas como `destructive: true` SIEMPRE requieren `confirmed: true`.

### 4. Confirmación de Acciones Destructivas

El LLM debe pedir confirmación verbal al dueño antes de llamar una tool destructiva:

```
Dueño: "Cancelá la reserva 123"
  → IA: "¿Confirmás cancelar la reserva de Juan Pérez (check-in 5 jul, check-out 8 jul)?"
Dueño: "Sí, confirmo"
  → IA llama cancel_reservation(confirmed: true)
```

El flag `confirmed: true` es OBLIGATORIO en el schema de la tool.

---

## Modelo de Datos

```typescript
interface AiManagerInteraction {
  id: UUID
  hotelId: UUID
  query: string                    // mensaje del dueño
  response: string                 // respuesta de la IA
  toolsCalled?: ToolCall[]         // [{ tool, args, result }]
  confidence?: number              // 0-1
  feedback?: 'helpful' | 'not_helpful' | 'inaccurate'
  responseTimeMs?: number
  createdAt: Date
}

interface ToolCall {
  tool: string                     // nombre de la tool ejecutada
  args: Record<string, unknown>    // argumentos enviados
  result: Record<string, unknown>  // resultado de la ejecución
  durationMs: number               // cuánto tomó ejecutar
}

interface ManagerConfig {
  hotelId: UUID
  mode: 'manual' | 'suggest' | 'autopilot'
  apiKey?: string                  // LLM API key (opcional, default DEEPSEEK_API_KEY)
  enabledTools: string[]           // tools habilitadas para este hotel
}
```

---

## Endpoints

```
POST   /api/ai/manager/ask                         # Enviar mensaje al gerente
GET    /api/ai/manager/interactions                 # Historial
PATCH  /api/ai/manager/interactions/:id/feedback    # Feedback

GET    /api/ai/manager/tools                        # Listar tools disponibles
POST   /api/ai/manager/mode                         # Cambiar modo
GET    /api/ai/manager/mode                         # Ver modo actual
```

---

## Flujo de Ejecución

```
Dueño escribe → POST /api/ai/manager/ask
       ↓
  Sistema arma: SYSTEM_PROMPT + KPIs actuales + historial
       ↓
  LLM recibe mensaje + tools disponibles
       ↓
  ┌────────────────────────────────────────────────┐
  │  Loop (máx 4 iteraciones):                     │
  │                                                 │
  │  LLM decide tool + argumentos                   │
  │       ↓                                         │
  │  executeManagerTool(name, args, hotelId)        │
  │       ↓                                         │
  │  Tool llama al endpoint REST real del sistema   │
  │       ↓                                         │
  │  Resultado vuelve al LLM                        │
  │       ↓                                         │
  │  ¿Más tools? → continuar                        │
  │  ¿Respuesta final? → salir del loop             │
  └────────────────────────────────────────────────┘
       ↓
  Guarda interacción + toolsCalled en DB
       ↓
  Devuelve respuesta al dueño
```

---

## Integración con LLM

```typescript
// Sistema: gerente ejecutor, NO chatbot pasivo
const systemPrompt = `
Sos el gerente IA del hotel "${hotel.name}".
Tenés acceso a tools que EJECUTAN acciones reales sobre el sistema.
Respondé en español, conciso y accionable.

REGLAS:
1. Usá ÚNICAMENTE datos reales de las tools (no inventes)
2. Acciones destructivas REQUIEREN confirmed:true
3. No ejecutes nada sin contexto suficiente
4. Si algo falla, informá y sugerí alternativas

KPIs actuales del hotel:
${JSON.stringify(kpis, null, 2)}
`

// Tools se pasan como function calling de OpenAI
const response = await llm.chat.completions.create({
  model: 'deepseek-chat',
  messages: [systemPrompt, ...history, userMessage],
  tools: MANAGER_TOOLS,  // ~55 tools
  tool_choice: 'auto',
})
```

---

## Implementación de Tools

Cada tool sigue el mismo patrón:

```typescript
// tools.ts — definición
{
  type: 'function',
  function: {
    name: 'execute_night_audit',
    description: 'Ejecutar el cierre de noche (night audit) del día.',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'YYYY-MM-DD (default: hoy)' }
      },
      required: []
    }
  }
}

// executeManagerTool — handler
case 'execute_night_audit': {
  const date = (args.date as string) || today
  // Llama al endpoint real del sistema
  const result = await fetch(`http://localhost:3000/api/night-audit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, hotelId })
  })
  const data = await result.json()
  return { ok: true, nightAuditDate: date, summary: data }
}
```

---

## Reglas de Negocio

1. Solo `hotel_admin` puede ejecutar el Gerente Virtual — ni receptionist ni super_admin tienen acceso
2. Las tools destructivas SIEMPRE requieren `confirmed:true` — el LLM debe pedir confirmación explícita
3. Modo **manual**: la IA responde preguntas pero NO ejecuta ninguna tool
4. Modo **autopilot**: la IA ejecuta automáticamente según thresholds de confianza
5. Loop máximo de 4 iteraciones para evitar loops infinitos
6. Cada tool ejecutada se registra en el historial con argumentos y resultado
7. El dueño puede ver el historial completo de acciones ejecutadas
8. Las tools NUNCA inventan datos — siempre consultan endpoints reales
9. Cada tool se implementa contra el endpoint REST existente del módulo correspondiente
10. Si una tool falla, el sistema lo informa y sugiere alternativas

---

## Verificación

```bash
# Backend — arckode analyze no debe mostrar violaciones
cd backend && bun run node_modules/arckode-framework/bin/arckode.js analyze

# Backend — typecheck + tests
cd backend && bun run typecheck && bun test

# Frontend (cuando exista)
cd frontend && npx vue-tsc --noEmit && bun run build
```
