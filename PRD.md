# PRD — ManagerHotel (SOLMI OS)

**Versión**: 2.0
**Fecha**: 2026-06-18
**Estado**: MVP funcional (12 módulos framework implementados de 26 planificados — ver `ARCHITECTURE.md`)

> Este documento define el **QUÉ** (producto y alcance). El **CÓMO** técnico está en `ARCHITECTURE.md`.

---

## 1. Visión General

**ManagerHotel** es un sistema operativo hotelero (Property Management System) diseñado para hoteles independientes de Latinoamérica. Combina 26 módulos integrados en 6 suites, con inteligencia artificial nativa, facturación electrónica en 6 países, y cero comisiones por reservas directas.

### Propuesta de Valor

- **26 módulos integrados** en una sola plataforma
- **IA nativa** en Revenue, Recepción y Gerencia Virtual
- **Facturación electrónica** en RD, Colombia, México, Perú, Chile, Argentina
- **Cero comisiones** por reservas directas
- **WhatsApp integrado** como columna vertebral de comunicación
- **Diseñado para LATAM**: soporte en español, facturación regional, pagos locales

---

## 2. Objetivos

| Objetivo | Métrica | Target |
|----------|---------|--------|
| Reducir carga administrativa | Tiempo en check-in | < 3 min |
| Aumentar reservas directas | % directas vs OTA | > 40% |
| Eliminar overbookings | Sobreventas/mes | 0 |
| Cumplimiento fiscal | Multas | 0 |
| Satisfacción del huésped | NPS | > 70 |

---

## 3. Usuario Target

### Perfil Primario
- **Owner/Manager** de hotel independiente (10-200 habitaciones)
- Ubicación: Latinoamérica (focus: RD, Colombia, México, Perú, Chile, Argentina)
- Necesidad: Operar más eficiente sin contratar más personal

### Perfil Secundario
- **Recepcionista**: Necesita herramienta fácil, sin curva de aprendizaje
- **Personal de limpieza**: App móvil simple para reportar estados
- **Contador**: Facturación electrónica automática

---

## 4. Módulos por Suite

### Suite 1: Core PMS 🏨
| ID | Módulo | Prioridad | Complejidad |
|----|--------|-----------|-------------|
| M01 | PMS Central | P0 | Alta |
| M05 | Recepción Digital | P0 | Media |
| M07 | Housekeeping Inteligente | P1 | Media |
| M08 | Mantenimiento | P1 | Baja |
| M24 | App SOLMI Staff | P1 | Media |
| M25 | App SOLMI Guest | P2 | Media |

### Suite 2: Ventas & Web 📈
| ID | Módulo | Prioridad | Complejidad |
|----|--------|-----------|-------------|
| M02 | Channel Manager | P0 | Alta |
| M03 | Motor de Reservas & Google Hotel | P0 | Alta |
| M04 | Creador de Sitio Web | P1 | Baja |
| M13 | Gestión de Cobros y Pagos | P0 | Alta |

### Suite 3: Inteligencia Artificial 🤖
| ID | Módulo | Prioridad | Complejidad |
|----|--------|-----------|-------------|
| M06 | Recepcionista Virtual con IA | P1 | Alta |
| M12 | Revenue Manager con IA | P1 | Alta |
| M17 | Gerente Virtual con IA ⭐ | P1 | Alta |

### Suite 4: Talento & Nómina 👥
| ID | Módulo | Prioridad | Complejidad |
|----|--------|-----------|-------------|
| M09 | Gestión de Empleados | P1 | Baja |
| M10 | Asistencia y Ponche Digital | P1 | Media |
| M11 | Nómina Automatizada | P1 | Media |
| M23 | Facturación Electrónica LATAM | P0 | Alta |

### Suite 5: CRM & Marketing ❤️
| ID | Módulo | Prioridad | Complejidad |
|----|--------|-----------|-------------|
| M14 | CRM y Fidelización | P2 | Media |
| M15 | Marketing Automatizado | P2 | Media |
| M20 | SOLMI Club | P2 | Alta |

### Suite 6: Ecosistema 🌐
| ID | Módulo | Prioridad | Complejidad |
|----|--------|-----------|-------------|
| M16 | Business Intelligence | P1 | Media |
| M18 | SOLMI Academy | P2 | Baja |
| M19 | Comunidad SOLMI | P3 | Baja |
| M21 | Multipropiedad | P2 | Alta |
| M22 | API Abierta e Integraciones | P1 | Alta |
| M26 | SOLMI Marketplace | P3 | Baja |

---

## 5. Planes de Pricing

| Plan | Habitaciones | Mensual | Anual/mes | Módulos Incluidos |
|------|-------------|---------|-----------|-------------------|
| Essential | ≤ 20 | $99 | $79 | M01, M02, M03, M04, M13, M16, M23 |
| Starter | ≤ 50 | $199 | $159 | Essential + M05, M07, M14, M18, M24 |
| Professional ⭐ | ≤ 100 | $349 | $279 | Starter + M06, M12, M11, M15, M16, M22 |
| Enterprise | ≤ 200 | $549 | $439 | Professional + M17, M21, M19, M25 |
| Ultra | 200+ | Custom | Custom | Todos los 26 módulos |

---

## 6. Integraciones Externas

### Channel Manager (M02)
- **Channex PMS** — API de sincronización bidireccional
- OTAs: Booking.com, Airbnb, Expedia, Agoda, Trip.com

### Pagos (M13)
- Stripe (tarjetas internacionales)
- Mercado Pago (LATAM)
- PayPal
- Transferencias bancarias con conciliación

### Facturación Electrónica (M23)
- **Rep. Dominicana**: DGII
- **Colombia**: DIAN
- **México**: SAT
- **Perú**: SUNAT
- **Chile**: SII
- **Argentina**: AFIP/ARCA

### Comunicación
- WhatsApp Business API (chatbot + notificaciones)
- Email (transaccional)
- Push notifications (apps móviles)

---

## 7. Requisitos No Funcionales

| Categoría | Requisito | Target |
|-----------|-----------|--------|
| Performance | Tiempo de carga página | < 2s |
| Performance | API response time | < 200ms |
| Disponibilidad | Uptime | 99.9% |
| Seguridad | Datos en tránsito | TLS 1.3 |
| Seguridad | Datos en reposo | AES-256 |
| Escalabilidad | Usuarios simultáneos | 1000+ |
| Escalabilidad | Propiedades multi-tenant | 500+ |
| Mobile | Apps staff/guest | iOS 14+ / Android 10+ |

---

## 8. Fases de Desarrollo

### Fase 1 — MVP (Meses 1-3)
- M01: PMS Central
- M05: Recepción Digital
- M13: Gestión de Pagos
- M23: Facturación Electrónica (RD)
- Auth + Multi-tenant básico

### Fase 2 — Core (Meses 4-6)
- M02: Channel Manager (Channex)
- M03: Motor de Reservas
- M07: Housekeeping
- M08: Mantenimiento

### Fase 3 — IA (Meses 7-9)
- M06: Recepcionista Virtual IA
- M12: Revenue Manager IA
- M17: Gerente Virtual IA
- M16: Business Intelligence

### Fase 4 — Talent (Meses 10-11)
- M09: Gestión Empleados
- M10: Asistencia Digital
- M11: Nómina Automatizada

### Fase 5 — Growth (Meses 12+)
- M14: CRM
- M15: Marketing
- M20: SOLMI Club
- M21: Multipropiedad
- M22: API Abierta

---

## 9. Métricas de Éxito

| Métrica | Target 6 meses | Target 12 meses |
|---------|----------------|-----------------|
| Hoteles activos | 50 | 200 |
| Reservas directas/mes | 500 | 3,000 |
| Revenue mensual | $15K | $80K |
| NPS score | > 60 | > 70 |
| Churn rate | < 10% | < 5% |

---

## 10. Riesgos

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Cambios en APIs de OTAs | Alto | Channex como capa de abstracción |
| Regulación fiscal cambia | Alto | Modularidad en módulo de facturación |
| Adopción lenta | Medio | Onboarding gratuito 30 días |
| Competencia (Cloudbeds, RoomRaccoon) | Medio | Focus LATAM + IA nativa |
| Costos de IA altos | Medio | Modelos locales + caching |
