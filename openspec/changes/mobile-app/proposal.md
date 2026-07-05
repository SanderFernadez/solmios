# Change Proposal: mobile-app

## Summary

Crear la app móvil Flutter para Manager Hotel con las mismasFeatures que el panel web: PIN login por rol, housekeeping (camarera/supervisor/mantenimiento), dashboard admin, habitaciones, reservas y mantenimiento.

## Motivation

El panel web funciona para administradores, pero el staff operativo (camareras, supervisores, técnicos) necesita una app móvil ligera con login por PIN, interfaces por rol, y flujo optimizado para tablets/teléfonos.

## Scope

### In Scope
1. **Infraestructura** — Flutter project, core/, shared widgets, Dio client, secure storage
2. **Auth PIN** — Selección de usuario + PIN de 4 dígitos
3. **Housekeeping** — CRUD completo + timer + fotos + aprobación + tickets
4. **Dashboard** — KPIs en tiempo real para admin
5. **Rooms** — Estado de habitaciones
6. **Reservations** — Listado y detalle
7. **Maintenance** — Tickets asignados

### Out of Scope
- Channel Manager (ya funciona en web)
- Pagos/Stripe (requiere credenciales)
- WhatsApp (requiere credenciales Meta)
- Pre-checkin QR
- Multi-property switching

## Approach

Feature-First + Clean Architecture (igual que delivery_app):
```
features/{name}/
├── data/          ← Repository impl + models
├── domain/        ← Entities + abstract repository
└── presentation/  ← Providers + screens + widgets
```

State: Riverpod StateNotifier + StateNotifierProvider
Navigation: go_router con ShellRoute

## Risks
- **Backend endpoints**: housekeeping PIN auth y aprobación no existen aún
- **DB**: tablas photo_requirements, supply_lists, supervisor_checklist no existen
- **Firebase**: requiere configuración FCM para notificaciones push

## Rollback
- Todo es aditivo (nueva carpeta mobile/)
- No modifica backend existente
- Nuevos endpoints son additivos
