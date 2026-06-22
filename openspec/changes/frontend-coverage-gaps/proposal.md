# Change Proposal: frontend-coverage-gaps

## Summary

Cubrir los 9 gaps de exposición detectados tras la auditoría de módulos backend vs frontend en ManagerHotel. Hay módulos del backend con endpoints vivos que ningún service/página consume, módulos parciales (sin vista propia), y nuevos endpoints de la sesión anterior (match-misterplan F1) que tampoco tienen página que los gestione.

## Motivation

El backend tiene 21 módulos con ~105 endpoints, pero el frontend solo consume ~75%. El 25% restante representa funcionalidad ya construida que el usuario no puede usar desde la UI. Esto genera:
- **Deuda invisible**: código backend funcionando pero sin valor real (apikeys, auditlog).
- **UX incompleta**: sistema sin centro de notificaciones ni vista de folios abiertos.
- **Anti-patrones**: páginas que ya tienen service pero llaman `http.get` directo (auto-messages, cerraduras).
- **Pérdida de seguimiento**: payment-requests y whatsapp-templates solo se crean puntualmente, no se gestionan.

## Scope

### In Scope (9 gaps — 4 categorías)

#### 🔴 Categoría A — Endpoints backend vivos, CERO consumidores
- **FC-A1**: Módulo `apikeys` — sin service ni página. Decidir: exponer o deprecate.
- **FC-A2**: Módulo `auditlog` — duplicado por `/admin/audit` en composition-root. Decidir cuál queda.

#### 🟡 Categoría B — Solo accesible vía super-admin
- **FC-B1**: `anuncios` — exponer para hotel-admin (anuncios internos dirigidos al equipo).
- **FC-B2**: `roles` — permitir hotel-admin gestionar roles de su equipo (no solo super-admin global).

#### 🟠 Categoría C — Módulos con service pero SIN página propia
- **FC-C1**: `folios` — crear vista propia "Folios Abiertos / In-House" para recepción.
- **FC-C2**: `notificaciones` — implementar centro de notificaciones (bell icon + bandeja).

#### 🔵 Categoría D — Nuevos endpoints sin página de gestión
- **FC-D1**: `/api/message-logs` — vista "Historial de envíos".
- **FC-D2**: `/api/payment-requests` — vista "Links de pago" con estados y reenvío.
- **FC-D3**: `/api/whatsapp-templates` — CRUD de plantillas WhatsApp.

#### 🟢 Categoría E — Refactor anti-patrón http directo
- **FC-E1**: `auto-messages` usar `AutoMessages.service` (4 llamadas).
- **FC-E2**: `cerraduras` usar `TTLock.service` (7 llamadas).
- **FC-E3**: Crear services faltantes: `Gastos.service`, `Opiniones.service`, `Caja.service`.

### Out of Scope
- Cambios en backend (todos los endpoints ya existen).
- Integraciones externas (Stripe real, TTLock real — están en match-misterplan F5/F9).
- Refactor visual de las páginas existentes.
- Mobile responsive (es ticket separado).

## Approach

Cada gap es independiente (cumple la regla "cada módulo es independiente del otro"). Se puede ejecutar en cualquier orden. La prioridad está basada en **impacto UX / effort**.

## Decisions Pending

1. **apikeys**: ¿lo exponemos (para integraciones de terceros) o lo deprecamos hasta que haya use case real?
2. **auditlog**: ¿unificamos bajo `/api/auditlog` (módulo) y eliminamos `/api/admin/audit`, o al revés?
3. **anuncios**: ¿el hotel-admin necesita ver anuncios internos de la plataforma? ¿O es solo super-admin?

Estas decisiones se toman en su respectiva task FC-A1/FC-A2/FC-B1 con input del usuario.

## Dependencies

- Ninguna bloqueante — todos los gaps pueden ejecutarse en paralelo.
- Recomiendo orden por prioridad (ver `tasks.md`).
