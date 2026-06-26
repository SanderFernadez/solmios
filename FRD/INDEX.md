# FRD · INDEX — Registro de Cobertura por Módulo

> Estado de documentación FRD de los 26 módulos de ManagerHotel (SOLMI OS).
> Cada módulo tiene (o tendrá) un archivo `Mxx-NOMBRE.md` siguiendo el molde de `M01-PMS-Central.md`.

**Leyenda de columnas:**
- **FRD**: 🟢 documentado · 🟡 en progreso · 🔴 pendiente
- **Impl backend**: ✅ módulo framework existe · ⚪ no implementado
- **Impl frontend**: ✅ página(s) existen · ⚪ no existe
- **Prioridad doc**: orden sugerido para documentar (1 = crítico)

---

## Suites y estado

### Suite 1 — Core PMS 🏨

| ID | Módulo | FRD | Impl BE | Impl FE | Prioridad | Archivo |
|----|--------|-----|---------|---------|-----------|---------|
| M01 | PMS Central | 🟢 | ✅ reservas/habitaciones/huespedes/folios | ✅ checkin/reservations/rooms/dashboard | ✅ hecho | `M01-PMS-Central.md` |
| M05 | Recepción Digital | 🟢 | ✅ reservas | ✅ checkin (staff) / ⚪ digital | 2 | `M05-Recepcion-Digital.md` |
| M07 | Housekeeping Inteligente | 🟢 | ✅ housekeeping | ✅ housekeeping | 2 | `M07-Housekeeping.md` |
| M08 | Mantenimiento | 🟢 | ✅ mantenimiento/tickets | ✅ maintenance | 3 | `M08-Mantenimiento.md` |
| M24 | App SOLMI Staff | 🟢 | ⚪ | ⚪ | 5 | `M24-App-Staff.md` |
| M25 | App SOLMI Guest | 🟢 | ⚪ | ⚪ | 5 | `M25-App-Guest.md` |

### Suite 2 — Ventas & Web 📈

| ID | Módulo | FRD | Impl BE | Impl FE | Prioridad | Archivo |
|----|--------|-----|---------|---------|-----------|---------|
| M02 | Channel Manager | 🟢 | ✅ canales | ✅ channel-manager/channel-detail | 1 | `M02-Channel-Manager.md` |
| M03 | Motor de Reservas & Google Hotel | 🟢 | ✅ paquetes (parcial) | ✅ booking-engine (config) | 2 | `M03-Motor-Reservas.md` |
| M04 | Creador de Sitio Web | 🟢 | ⚪ | ⚪ | 5 | `M04-Sitio-Web.md` |
| M13 | Gestión de Cobros y Pagos | 🟢 | ✅ facturas/folios/gastos | ✅ billing/gastos | 1 | `M13-Cobros-Pagos.md` |

### Suite 3 — Inteligencia Artificial 🤖

| ID | Módulo | FRD | Impl BE | Impl FE | Prioridad | Archivo |
|----|--------|-----|---------|---------|-----------|---------|
| M06 | Recepcionista Virtual con IA | 🟢 | ⚪ | ⚪ (chat placeholder) | 4 | `M06-IA-Recepcionista.md`, `M06-TRD-IA-Recepcionista.md`, `M06-FLOW-Integracion.md` |
| M12 | Revenue Manager con IA | 🟢 | ⚪ | ⚪ | 4 | `M12-IA-Revenue.md` |
| M17 | Gerente Virtual con IA ⭐ | 🟢 | ⚪ | ⚪ | 4 | `M17-IA-Gerente.md` |

### Suite 4 — Talento & Nómina 👥

| ID | Módulo | FRD | Impl BE | Impl FE | Prioridad | Archivo |
|----|--------|-----|---------|---------|-----------|---------|
| M09 | Gestión de Empleados | 🟢 | ✅ usuarios/roles | ⚪ | 3 | `M09-Empleados.md` |
| M10 | Asistencia y Ponche Digital | 🟢 | ⚪ | ⚪ | 4 | `M10-Asistencia.md` |
| M11 | Nómina Automatizada | 🟢 | ⚪ | ⚪ | 4 | `M11-Nomina.md` |
| M23 | Facturación Electrónica LATAM | 🟢 | ✅ facturas | ✅ billing (parcial) | 1 | `M23-Facturacion-LATAM.md` |

### Suite 5 — CRM & Marketing ❤️

| ID | Módulo | FRD | Impl BE | Impl FE | Prioridad | Archivo |
|----|--------|-----|---------|---------|-----------|---------|
| M14 | CRM y Fidelización | 🟢 | ✅ huespedes/opiniones | ✅ guests/opiniones | 3 | `M14-CRM.md` |
| M15 | Marketing Automatizado | 🟢 | ⚪ | ⚪ | 5 | `M15-Marketing.md` |
| M20 | SOLMI Club | 🟢 | ⚪ | ⚪ | 5 | `M20-Solmi-Club.md` |

### Suite 6 — Ecosistema 🌐

| ID | Módulo | FRD | Impl BE | Impl FE | Prioridad | Archivo |
|----|--------|-----|---------|---------|-----------|---------|
| M16 | Business Intelligence | 🟢 | ⚪ | ✅ reports (parcial) | 2 | `M16-BI.md` |
| M18 | SOLMI Academy | 🟢 | ⚪ | ⚪ | 5 | `M18-Academy.md` |
| M19 | Comunidad SOLMI | 🟢 | ⚪ | ⚪ | 6 | `M19-Comunidad.md` |
| M21 | Multipropiedad | 🟢 | ✅ hoteles | ✅ super-admin (multi-hotel) | 3 | `M21-Multipropiedad.md` |
| M22 | API Abierta e Integraciones | 🟢 | ✅ apikeys | ✅ devices/api-keys | 3 | `M22-API-Integraciones.md` |
| M26 | SOLMI Marketplace | 🟢 | ⚪ | ⚪ | 6 | `M26-Marketplace.md` |

### Transversales (no son módulo de producto pero tienen pantallas)

| Pantalla | FRD | Impl FE | Archivo |
|----------|-----|---------|---------|
| Auth / Login | 🟢 | ✅ auth/login | `T0-Auth.md` |
| Super-Admin (plataforma) | 🟢 | ✅ super-admin/* (12 sub-pantallas) | `T1-Super-Admin.md` |
| Settings / Configuración | 🟢 | ✅ settings | `T2-Settings.md` |
| Night Audit (cierre nocturno) | 🟢 | ✅ night-audit | `T3-Night-Audit.md` |
| Planning (rack) | 🟢 | ✅ planning | `T4-Planning.md` |
| Support | 🟢 | ✅ support | `T5-Support.md` |
| Landing (público) | 🟢 | ✅ landing | `T6-Landing.md` |

---

## Resumen

| Métrica | Valor |
|---------|-------|
| Módulos de producto | 26 |
| Transversales | 7 |
| **Documentados en FRD (hoy)** | **33/33** ✅ COMPLETO |
| Implementados en backend | ~16 (de 21 carpetas en `backend/src/modules/`) |
| Páginas frontend existentes | 21 |

---

## Plan de cobertura — ✅ COMPLETO

Todas las olas terminadas. Cada módulo tiene su FRD con Decision Tables + Mermaid Flows.

| Ola | Módulos | Estado |
|-----|---------|--------|
| Ola 1 — Críticos operativos | M02, M13, M23, M07, M05 | ✅ |
| Ola 2 — Operación secundaria | M08, M03, M16, T3, T1 | ✅ |
| Ola 3 — CRM / Talento | M14, M21, M22, M09, T0, T2 | ✅ |
| Ola 4 — IA | M06, M12, M17, M10, M11 | ✅ |
| Ola 5 — Ecosistema | M15, M18, M19, M20, M24, M25, M26, M04 | ✅ |
| Transversales | T4, T5, T6 | ✅ |

---

*Cobertura FRD completa. 33/33 módulos documentados.*
