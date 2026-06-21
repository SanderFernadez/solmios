# FRD · M10 — Asistencia y Ponche Digital

> **Módulo NO implementado (target/spec).** Define el sistema de control de asistencia de empleados — fichaje digital, reconocimiento biométrico/facial, reportes de asistencia, y gestión de horarios. NO existe código en frontend ni backend — todo es especificación para desarrollo futuro.
>
> **Veredicto del módulo:** 🔴 No implementado. Sin backend, sin frontend, sin integración biométrica.
> **Dependencia:** Requiere M09 (Gestión de Empleados) como fuente de verdad de empleados.

**Módulo:** M10 — Asistencia y Ponche Digital
**Pantallas cubiertas (target):** Ponche Digital (`/panel/attendance`) · Dashboard Asistencia (`/panel/attendance/dashboard`) · Horarios y Turnos (`/panel/attendance/schedules`) · Reportes de Asistencia (`/panel/attendance/reports`) · Configuración Biometría (`/panel/attendance/biometrics`)
**Servicios frontend (target):** `Attendance.service.ts`, `Schedule.service.ts`
**Servicios backend (target):** módulo `attendance` (fichaje, horarios, reportes), integración biométrica

---

## 1. Modelo de datos (target schema)

### 1.1 Registros de asistencia (`attendance_records`)

| Campo | Tipo | Reglas | Descripción |
|-------|------|--------|-------------|
| `id` | string | required, uuid | — |
| `employeeId` | string | required, FK → `users.id` | Empleado que fichó |
| `hotelId` | string | indexed, multi-tenant | — |
| `date` | date | required | Fecha del fichaje |
| `clockIn` | datetime | nullable | Hora de entrada |
| `clockOut` | datetime | nullable | Hora de salida |
| `breakStart` | datetime | nullable | Inicio de descanso |
| `breakEnd` | datetime | nullable | Fin de descanso |
| `totalHours` | number | nullable, computed | Horas trabajadas (clockOut - clockIn - breaks) |
| `overtimeHours` | number | default 0 | Horas extra (si superan jornada estándar) |
| `status` | enum | required | `present` · `absent` · `late` · `early_departure` · `on_leave` · `holiday` |
| `method` | enum | required | `pin` · `facial` · `fingerprint` · `mobile_gps` · `manual` |
| `location` | json | nullable | `{ lat, lng }` si fichaje móvil GPS |
| `notes` | text | nullable | Notas del empleado o del supervisor |
| `approvedBy` | string | nullable, FK → `users.id` | Supervisor que aprobó (para fichaje manual) |
| `createdAt` | datetime | required | Timestamp del registro |

### 1.2 Horarios / Turnos (`attendance_schedules`)

| Campo | Tipo | Reglas | Descripción |
|-------|------|--------|-------------|
| `id` | string | required | — |
| `hotelId` | string | indexed | — |
| `name` | string | required | Nombre del turno (ej: "Turno Mañana", "Turno Noche") |
| `startTime` | string | required, HH:mm | Hora de inicio (ej: "06:00") |
| `endTime` | string | required, HH:mm | Hora de fin (ej: "14:00") |
| `breakMinutes` | number | default 60 | Minutos de descanso |
| `graceMinutes` | number | default 15 | Tolerancia de llegada (minutos) |
| `overtimeThresholdMinutes` | number | default 0 | Minutos extras antes de contar como overtime |
| `active` | number | default 1 | — |

### 1.3 Asignación de turnos (`attendance_assignments`)

| Campo | Tipo | Reglas | Descripción |
|-------|------|--------|-------------|
| `id` | string | required | — |
| `employeeId` | string | required, FK → `users.id` | — |
| `scheduleId` | string | required, FK → `attendance_schedules.id` | — |
| `startDate` | date | required | Inicio de la asignación |
| `endDate` | nullable | — | Fin (null = indefinido) |
| `daysOfWeek` | json | required, array | `[1,2,3,4,5]` = lunes a viernes |
| `active` | number | default 1 | — |

### 1.4 Permisos y vacaciones (`attendance_leave_requests`)

| Campo | Tipo | Reglas | Descripción |
|-------|------|--------|-------------|
| `id` | string | required | — |
| `employeeId` | string | required, FK → `users.id` | — |
| `hotelId` | string | indexed | — |
| `type` | enum | required | `vacation` · `sick_leave` · `personal` · `maternity` · `unpaid` |
| `startDate` | date | required | — |
| `endDate` | date | required | — |
| `days` | number | required | Días solicitados |
| `reason` | text | nullable | — |
| `status` | enum | required | `pending` · `approved` · `rejected` · `cancelled` |
| `approvedBy` | string | nullable, FK → `users.id` | — |
| `approvedAt` | datetime | nullable | — |
| `rejectionReason` | text | nullable | — |
| `createdAt` | datetime | required | — |

### 1.5 Configuración de asistencia (`attendance_config`)

| Campo | Tipo | Reglas | Descripción |
|-------|------|--------|-------------|
| `id` | string | required | — |
| `hotelId` | string | unique | — |
| `defaultScheduleId` | string | nullable, FK → `attendance_schedules.id` | Horario por defecto para empleados nuevos |
| `requirePhotoOnClockIn` | number | default 0 | Exigir selfie al fichar |
| `requireLocationOnClockIn` | number | default 0 | Exigir GPS al fichar |
| `geoFenceRadiusMeters` | number | default 100 | Radio允许 desde ubicación del hotel |
| `allowMobileClockIn` | number | default 0 | Permitir fichaje desde app móvil |
| `autoClockOut` | number | default 0 | Auto-cierre si no ficha salida |
| `autoClockOutTime` | string | default "23:59" | Hora de auto-cierre |
| `overtimeEnabled` | number | default 0 | Permitir horas extra |
| `overtimeMultiplier` | number | default 1.5 | Multiplicador de horas extra |
| `weeklyHoursLimit` | number | default 48 | Máximo horas semanales |

---

## 2. Pantalla — Ponche Digital (`/panel/attendance`)

> ⚠ **NO implementado.** Toda esta sección es TARGET.

Interfaz de fichaje para empleados. Botón grande de entrada/salida, estado actual del turno, historial del día.

### 2.1 Decision Table

| Trigger | Condición | Resultado | Modal/Toast (texto literal) | Errores | Notif F5 |
|---------|-----------|-----------|------------------------------|---------|----------|
| Botón **"🕐 Fichar Entrada"** | `clockIn = null` hoy | Abre modal de verificación (PIN o facial) | Modal `confirm`: "Fichar entrada — {empleado}" | — | — |
| **"Confirmar entrada"** (PIN correcto o facial reconocido) | método válido, dentro de geocerca si aplica | Crea `attendance_records` con `clockIn = now()`, `status = present` | Toast success: "Entrada registrada a las {HH:mm}. ¡Buen día, {nombre}!" | E2 "Entrada ya registrada hoy" · E2 "Fuera de la geocerca (radio {n}m)" · E6 "Error de reconocimiento facial" | F5 a supervisor: "{empleado} fichó entrada" |
| Botón **"🕐 Fichar Salida"** | `clockIn` registrado, `clockOut = null` | Abre modal de verificación | Modal `confirm`: "Fichar salida — {empleado}" | — | — |
| **"Confirmar salida"** | — | Actualiza `clockOut`, calcula `totalHours`, `overtimeHours` | Toast success: "Salida registrada. Trabajaste {n}h {m}min." | E6 | F5 a supervisor: "{empleado} fichó salida — {n}h trabajadas" |
| Botón **"☕ Iniciar descanso"** | `clockIn` registrado, `breakStart = null` | Actualiza `breakStart` | Toast info: "Descanso iniciado." | — | — |
| Botón **"☕ Fin descanso"** | `breakStart` registrado, `breakEnd = null` | Actualiza `breakEnd` | Toast info: "Descanso finalizado. Volvés a trabajar." | — | — |
| **"📸 Fichar con foto"** (si `requirePhotoOnClockIn = 1`) | — | Abre cámara, captura selfie, verifica contra foto de perfil | — | E6 "No se pudo capturar foto" · E2 "La foto no coincide con tu perfil" | — |
| **"📍 Fichar con GPS"** (si `requireLocationOnClockIn = 1`) | — | Obtiene ubicación, verifica radio | — | E2 "Estás a {n}m del hotel. Acercate para fichar." | — |
| **"Fichar manualmente"** (supervisor) | `role = hotel_admin` | Abre modal form: empleado, hora entrada, hora salida, motivo | Modal `form`: "Fichaje Manual" | — | — |
| **"Guardar fichaje manual"** | empleado + horas presentes | POST `/api/attendance/records` con `method = manual` | Toast success: "Fichaje manual registrado para {empleado}." | E1 "Faltan campos obligatorios" · E6 | — |

### 2.2 Flow — Fichaje de entrada

```mermaid
flowchart TD
    A([Empleado clic 'Fichar Entrada']) --> B[Abre modal verificación]
    B --> C{¿Método?}
    C -- PIN --> D[/Empleado ingresa PIN/]
    C -- Facial --> E[Activa cámara]
    E --> F[Reconocimiento facial]
    F -- falla --> X1[E6 Toast: 'Error de reconocimiento']
    D --> G{PIN correcto?}
    G -- no --> X2[E2 Toast: 'PIN incorrecto. Intentá de nuevo.'}
    G -- sí --> H{¿GPS habilitado?}
    F -- sí --> H
    H -- sí --> I[Verifica geocerca]
    I -- fuera --> X3[E2 Toast: 'Fuera de alcance. Acercate al hotel.']
    I -- dentro --> J[POST /api/attendance/records]
    H -- no --> J
    J --> K{HTTP 201?}
    K -- sí --> L[Toast success: 'Entrada registrada a las {hora}.']
    L --> M[F5 a supervisor]
    K -- 5xx --> X4[E6 Toast: 'Sin conexión.']
    K -- 400 --> X5[E2 Toast: 'Entrada ya registrada hoy.']
```

---

## 3. Pantalla — Dashboard Asistencia (`/panel/attendance/dashboard`)

> ⚠ **TARGET.** No implementado.

Vista para supervisor/admin: quién está presente, ausente, tarde, en descanso.

### 3.1 KPIs target

| KPI | Cálculo |
|-----|---------|
| **Presentes ahora** | `attendance_records` de hoy con `clockIn` set y `clockOut = null` |
| **Ausentes** | Empleados asignados sin registro hoy |
| **Tardanzas** | `status = late` (llegada > graceMinutes después del turno) |
| **Salidas tempranas** | `status = early_departure` |
| **En descanso** | `breakStart` set y `breakEnd = null` |
| **Horas extra hoy** | Suma de `overtimeHours` de todos |
| **Asistencia del mes** | Registros `present` / días laborables × 100 |

### 3.2 Decision Table

| Trigger | Condición | Resultado | Modal/Toast (texto) | Errores | Notif F5 |
|---------|-----------|-----------|----------------------|---------|----------|
| Cargar página | — | Lista de empleados con estado actual | — | E6 | — |
| Filtro **"Todos / Presentes / Ausentes / Tardes"** | — | Filtra lista | — | — | — |
| Clic en empleado | — | Abre **modal detail**: fichajes del día, horas, estado | Modal `detail` | — | — |
| **"📧 Notificar ausencia"** (botón en empleado ausente) | `status = absent` | Envía notificación push/WhatsApp al empleado | Toast success: "Notificación enviada a {empleado}." | E6 | — |
| **"📝 Marcar permiso"** (en empleado) | — | Abre modal: tipo de permiso, fechas | Modal `form`: "Registrar Permiso" | — | — |
| **"📥 Exportar asistencia del mes"** | — | Genera Excel con todos los registros | Toast success: "Asistencia exportada." | E6 | — |
| **"🔄 Sincronizar con biométrico"** (si aplica) | — | Importa datos del reloj biométrico | Loading → Toast success: "Sincronizados {n} registros." | E6 "Error de conexión con dispositivo biométrico" | — |

---

## 4. Pantalla — Horarios y Turnos (`/panel/attendance/schedules`)

> ⚠ **TARGET.** No implementado.

CRUD de turnos y asignación de empleados a turnos.

### 4.1 Decision Table

| Trigger | Condición | Resultado | Modal/Toast (texto) | Errores | Notif F5 |
|---------|-----------|-----------|----------------------|---------|----------|
| **"+ Nuevo Turno"** | — | Abre modal form: nombre, hora inicio/fin, descanso, tolerancia | Modal `form`: "Nuevo Turno" | — | — |
| **"Guardar Turno"** | nombre + horas presentes | POST `/api/attendance/schedules` | Toast success: "Turno '{nombre}' creado." | E1 "Faltan campos" · E2 "El turno se superpone con otro" · E6 | — |
| Editar turno existente | — | Abre modal form precargado | Modal `form`: "Editar Turno" | — | — |
| Toggle **"Activo/Inactivo"** | — | PATCH `active` | — | E6 | — |
| **"Eliminar"** turno | sin empleados asignados | Modal danger: "¿Eliminar turno '{nombre}'?" | Toast success: "Turno eliminado." | E2 "Hay {n} empleados asignados a este turno. Reasignalos primero." · E6 | — |
| **"+ Asignar empleado"** (pestaña asignaciones) | — | Abre modal: selector empleado + turno + días | Modal `form`: "Asignar Turno" | — | — |
| **"Guardar asignación"** | empleado + turno + días seleccionados | POST `/api/attendance/assignments` | Toast success: "{empleado} asignado a {turno}." | E2 "Ya tiene un turno asignado esos días" · E6 | — |
| **"Ver calendario de turnos"** (botón) | — | Vista calendario con turnos por día/empleado | — | — | — |

---

## 5. Pantalla — Reportes de Asistencia (`/panel/attendance/reports`)

> ⚠ **TARGET.** No implementado.

Reportes exportables de asistencia por empleado, departamento, período.

### 5.1 Decision Table

| Trigger | Condición | Resultado | Modal/Toast (texto) | Errores | Notif F5 |
|---------|-----------|-----------|----------------------|---------|----------|
| Cargar página | — | Form: empleado (o todos), período (fecha inicio/fin) | — | E6 | — |
| **"Generar reporte"** | período válido | POST `/api/attendance/reports` → muestra tabla + resumen | — | E1 "Seleccioná un período válido" · E6 | — |
| **"📥 Exportar PDF"** | reporte generado | Genera PDF con tabla y estadísticas | Toast success: "PDF descargado." | E6 | — |
| **"📥 Exportar Excel"** | reporte generado | Genera Excel | Toast success: "Excel descargado." | E6 | — |
| **"📧 Enviar por email"** | reporte generado | Abre modal destinatarios | Modal `form`: "Enviar Reporte" | — | — |
| Selector **"Empleado / Departamento / Todos"** | — | Cambia alcance del reporte | — | — | — |
| **"Ver detalle"** (en fila de empleado) | — | Abre tabla con cada día: entrada, salida, horas, estado | Modal `detail` | — | — |

### 5.2 Métricas del reporte

| Métrica | Cálculo |
|---------|---------|
| **Días trabajados** | COUNT registros `present` + `late` + `early_departure` |
| **Días ausentes** | Días laborables - días trabajados |
| **Tardanzas** | COUNT registros `status = late` |
| **Horas trabajadas totales** | SUM `totalHours` |
| **Horas extra totales** | SUM `overtimeHours` |
| **Promedio horas/día** | `totalHours / daysWorked` |
| **Tasa de asistencia** | `daysWorked / totalWorkDays × 100` |

---

## 6. Pantalla — Configuración Biometría (`/panel/attendance/biometrics`)

> ⚠ **TARGET.** No implementado.

Configuración de dispositivos biométricos y reconocimiento facial.

### 6.1 Decision Table

| Trigger | Condición | Resultado | Modal/Toast (texto) | Errores | Notif F5 |
|---------|-----------|-----------|----------------------|---------|----------|
| **"+ Agregar dispositivo"** | — | Abre modal: nombre, tipo, IP | Modal `form`: "Agregar Dispositivo Biométrico" | — | — |
| **"Guardar dispositivo"** | nombre + IP válida | POST `/api/attendance/devices` | Toast success: "Dispositivo '{nombre}' registrado." | E1 · E2 "IP duplicada" · E6 | — |
| **"🔌 Probar conexión"** (en dispositivo) | — | Envía ping al dispositivo | Toast success: "Conexión exitosa." o Toast error: "No se pudo conectar." | E6 "Dispositivo no alcanzable" | — |
| **"🔄 Sincronizar empleados"** (en dispositivo) | — | Envía roster de empleados al dispositivo | Loading → Toast success: "{n} empleados sincronizados." | E6 | — |
| **"📥 Importar registros"** (del dispositivo) | — | Descarga registros del reloj biométrico | Loading → Toast success: "{n} registros importados." | E6 "Error de comunicación" | — |
| **"📸 Capturar rostro"** (empleado) | — | Activa cámara para registro facial | — | E6 "No se pudo capturar rostro" | — |
| **"🗑 Eliminar rostro"** (empleado) | — | Modal danger: "¿Eliminar datos faciales de {empleado}?" | Toast success: "Rostro eliminado." | E6 | — |
| **"Configurar geocerca"** (pestaña) | — | Mapa con radio configurable | — | — | — |

---

## 7. Endpoints target (backend)

| Método | Ruta | Rol | Descripción | ¿Implementado? |
|--------|------|-----|-------------|----------------|
| POST | `/api/attendance/clock-in` | employee, hotel_admin | Fichar entrada | ❌ no implementado |
| POST | `/api/attendance/clock-out` | employee, hotel_admin | Fichar salida | ❌ no implementado |
| POST | `/api/attendance/break/start` | employee | Iniciar descanso | ❌ no implementado |
| POST | `/api/attendance/break/end` | employee | Finalizar descanso | ❌ no implementado |
| GET | `/api/attendance/records` | hotel_admin, employee | Registros de asistencia | ❌ no implementado |
| GET | `/api/attendance/records/today` | employee | Mi registro de hoy | ❌ no implementado |
| POST | `/api/attendance/records/manual` | hotel_admin | Fichaje manual | ❌ no implementado |
| GET | `/api/attendance/dashboard` | hotel_admin | Dashboard de asistencia | ❌ no implementado |
| GET | `/api/attendance/schedules` | hotel_admin | Listar turnos | ❌ no implementado |
| POST | `/api/attendance/schedules` | hotel_admin | Crear turno | ❌ no implementado |
| PUT | `/api/attendance/schedules/:id` | hotel_admin | Editar turno | ❌ no implementado |
| DELETE | `/api/attendance/schedules/:id` | hotel_admin | Eliminar turno | ❌ no implementado |
| GET | `/api/attendance/assignments` | hotel_admin | Listar asignaciones | ❌ no implementado |
| POST | `/api/attendance/assignments` | hotel_admin | Asignar empleado a turno | ❌ no implementado |
| DELETE | `/api/attendance/assignments/:id` | hotel_admin | Quitar asignación | ❌ no implementado |
| GET | `/api/attendance/leave-requests` | hotel_admin, employee | Solicitudes de permiso | ❌ no implementado |
| POST | `/api/attendance/leave-requests` | employee | Solicitar permiso | ❌ no implementado |
| PATCH | `/api/attendance/leave-requests/:id/approve` | hotel_admin | Aprobar permiso | ❌ no implementado |
| PATCH | `/api/attendance/leave-requests/:id/reject` | hotel_admin | Rechazar permiso | ❌ no implementado |
| GET | `/api/attendance/reports` | hotel_admin | Reporte de asistencia | ❌ no implementado |
| POST | `/api/attendance/reports/export` | hotel_admin | Exportar reporte PDF/Excel | ❌ no implementado |
| GET | `/api/attendance/config` | hotel_admin | Ver configuración | ❌ no implementado |
| PUT | `/api/attendance/config` | hotel_admin | Guardar configuración | ❌ no implementado |
| POST | `/api/attendance/facial/verify` | employee | Verificar rostro (fichaje) | ❌ no implementado |
| POST | `/api/attendance/facial/enroll` | hotel_admin | Registrar rostro de empleado | ❌ no implementado |
| POST | `/api/attendance/biometric/sync` | hotel_admin | Sincronizar con dispositivo | ❌ no implementado |

---

## 8. Consecuencias cross-módulo (eventos que dispara M10)

| Acción en M10 | Módulo afectado | Efecto | Estado |
|---------------|-----------------|--------|--------|
| Empleado ficha entrada | M09 — Empleados | Actualiza `lastClockIn` en expediente | ❌ target |
| Empleado ficha salida | M11 — Nómina | Alimenta horas trabajadas para cálculo de salario | ❌ target |
| Horas extra registradas | M11 — Nómina | Se multiplican por `overtimeMultiplier` en nómina | ❌ target |
| Permiso aprobado | M09 — Empleados | Marca empleado como `on_leave` en esos días | ❌ target |
| Empleado ausente sin justificación | Notificaciones (M-notif) | Alerta a RRHH: "{empleado} no fichó" | ❌ target |
| Fichaje manual por supervisor | Audit Log | Registro de auditoría: "Fichaje manual de {empleado} por {supervisor}" | ❌ target |
| Empleado desactivado en M09 | M10 | Cerrar fichajes abiertos, desactivar turnos | ❌ target |
| Vencimiento de documentos | M09 — Empleados | Alerta: "Vence licencia de {empleado}" | ❌ target |

---

## 9. Reglas de negocio (E2)

| # | Regla | Texto canónico | ¿Implementada? |
|---|-------|----------------|----------------|
| 1 | **Doble entrada** (ya tiene `clockIn` hoy) | "Ya registraste tu entrada hoy a las {hora}. Si es un error, contactá a tu supervisor." | ❌ target |
| 2 | **Salida sin entrada** | "No podés fichar salida sin haber fichado entrada primero." | ❌ target |
| 3 | **Fuera de geocerca** | "Estás a {n} metros del hotel. Acercate al establecimiento para fichar." | ❌ target |
| 4 | **PIN incorrecto 3 veces** | "PIN bloqueado temporalmente. Esperá {n} minutos o usá reconocimiento facial." | ❌ target |
| 5 | **Rostro no reconocido** | "No se pudo verificar tu identidad. Intentá con PIN o contactá a tu supervisor." | ❌ target |
| 6 | **Turno ya asignado esos días** | "{empleado} ya tiene un turno asignado los días {días}. Desasignalos primero." | ❌ target |
| 7 | **Turnos superpuestos** | "El turno '{nombre}' se superpone con '{otro}'. Ajustá los horarios." | ❌ target |
| 8 | **Permiso sin días disponibles** | "No te quedan días de {tipo} disponibles. Te quedan {n} días este año." | ❌ target |
| 9 | **Horas extra exceden límite semanal** | "Las horas extra de {empleado} exceden el límite de {n}h/semana." | ❌ target |

---

## 10. Gap analysis

| # | Feature | Existe hoy | Gap |
|---|---------|------------|-----|
| G1 | Fichaje digital (PIN) | ❌ | No hay endpoint, no hay UI de fichaje |
| G2 | Reconocimiento facial | ❌ | No hay integración con modelo facial, no hay cámara en UI |
| G3 | Fichaje móvil con GPS | ❌ | No hay geocerca, no hay captura de ubicación |
| G4 | Dashboard de asistencia en tiempo real | ❌ | No hay dashboard, no hay datos en vivo |
| G5 | Gestión de turnos y horarios | ❌ | No hay tablas de turnos, no hay CRUD |
| G6 | Asignación de turnos a empleados | ❌ | No hay tabla de asignaciones |
| G7 | Permisos y vacaciones | ❌ | No hay leave_requests, no hay workflow de aprobación |
| G8 | Reportes de asistencia exportables | ❌ | No hay generación de reportes, no hay export PDF/Excel |
| G9 | Integración con reloj biométrico | ❌ | No hay protocolo de comunicación con dispositivos |
| G10 | Cálculo automático de horas extra | ❌ | No hay lógica de overtime, no hay multiplicador |
| G11 | Configuración de geocerca | ❌ | No hay mapa, no hay radio configurable |
| G12 | Alertas de ausencia | ❌ | No hay notificaciones automáticas de inasistencia |

**Total de gaps: 12 features bloqueantes. Módulo completamente sin implementar.**

---

## 11. Checklist de verificación M10

### Backend
- [ ] Tabla `attendance_records` creada con datos de prueba
- [ ] Tabla `attendance_schedules` con 3 turnos ejemplo
- [ ] Tabla `attendance_assignments` con empleados asignados
- [ ] Tabla `attendance_leave_requests` con solicitudes ejemplo
- [ ] Tabla `attendance_config` con config por hotel
- [ ] Endpoint POST `/api/attendance/clock-in` funcional
- [ ] Endpoint POST `/api/attendance/clock-out` funcional
- [ ] Cálculo de `totalHours` y `overtimeHours` correcto
- [ ] Detección de `status = late` (llegada > graceMinutes)
- [ ] CRUD de turnos y asignaciones
- [ ] Workflow de permisos (solicitar → aprobar/rechazar)
- [ ] Endpoint de dashboard (presentes/ausentes/tardes)
- [ ] Endpoint de reportes con métricas
- [ ] Validación E2: doble entrada
- [ ] Validación E2: salida sin entrada
- [ ] Validación E2: fuera de geocerca
- [ ] Validación E2: turnos superpuestos

### Frontend
- [ ] Página `/panel/attendance` con botón de fichaje + estado actual
- [ ] Página `/panel/attendance/dashboard` con vista de supervisor
- [ ] Página `/panel/attendance/schedules` con CRUD de turnos + asignaciones
- [ ] Página `/panel/attendance/reports` con form + tabla + export
- [ ] Página `/panel/attendance/biometrics` con config de dispositivos
- [ ] Modal `confirm` para fichar entrada/salida
- [ ] Modal `form` para fichaje manual
- [ ] Modal `form` para crear/editar turnos
- [ ] Modal `form` para solicitar permiso
- [ ] Modal `detail` para ver fichajes del día de un empleado
- [ ] Toast success en cada acción
- [ ] Toast error E1/E2/E6 con texto canónico
- [ ] Loading state (F6) en botones de fichaje
- [ ] Botón de fichaje con estado visual (verde=activo, gris=inactivo)
- [ ] Skeleton de carga en dashboard
- [ ] Estado vacío (F4): "Sin registros de asistencia hoy"

### Integración
- [ ] Empleados de M09 aparecen en selector de asignación de turnos
- [ ] Fichaje de salida calcula horas correctamente (con descansos)
- [ ] Horas extra se reflejan en M11 (Nómina) cuando se implemente
- [ ] Permiso aprobado marca empleado como `on_leave`
- [ ] Reconocimiento facial verifica contra foto de perfil

---

*Este documento sigue el molde de `M01-PMS-Central.md`. Módulo NO implementado — toda documentación es target/spec para desarrollo futuro.*
