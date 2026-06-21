# Change Proposal: match-misterplan

## Summary

Replicar TODA la funcionalidad de MisterPlan CloudV2 en ManagerHotel, basándose en el análisis exhaustivo realizado (ANALISIS-MRPLAN.md).

## Motivation

ManagerHotel tiene la base funcionando pero le faltan funcionalidades críticas que un hotel real necesita: cerraduras TTLock, planning visual drag-drop, modal de reserva completo, envíos automáticos, pre-checkin, y configuración detallada.

## Scope

### In Scope (10 fases)
1. **Foundation DB** — Nuevas tablas + columnas (amenities, seasons, rates, locks, auto-messages, companions)
2. **Planning Visual** — Calendario drag-drop con FullCalendar, bloqueos, context menu
3. **Reservation Modal** — TODOS los campos (origen OTA, comisión, pagos, acompañantes, comunicaciones)
4. **TTLock Integration** — Cerraduras electrónicas, códigos remotos, auto-envío
5. **Auto Messages** — Editor visual de envíos programados multi-canal
6. **Complete Settings** — Amenities (100+), tarifas matriz, mapa, multilingüe, campos legales
7. **WhatsApp** — Links wa.me + plantillas + auto-envío
8. **Pre-checkin** — QR + escaneo documentos + auto-checkin
9. **Payment Requests** — Links de pago Stripe desde reserva
10. **Advanced Reports** — Facturación, ocupación, pernoctaciones, rendimiento, procedencia

### Out of Scope
- Channel Manager mejoras (ya funciona con Channex)
- Migración a otra DB (se mantiene SQLite)
- App móvil nativa
- Multi-property switching (1 hotel por sesión)

## Approach

Implementar en orden de dependencias:
```
Fase 1 (DB) → Fase 6 (Settings) → Fase 3 (Modal) → Fase 2 (Planning)
                                                          ↓
Fase 4 (TTLock) → Fase 5 (Auto-msg) → Fase 7 (WhatsApp)
Fase 8 (Pre-checkin) | Fase 9 (Pagos) [paralelo]
                                                          ↓
                                                    Fase 10 (Reportes)
```

## Risks
- **TTLock API**: requiere cuenta en open.ttlock.com, puede demorar aprobación
- **WhatsApp Business API**: requiere verificación de negocio por Meta (1-2 semanas)
- **Planning drag-drop**: FullCalendar resource view es complejo, puede necesitar licencia premium
- **DB migration**: agregar columnas a tablas existentes con datos requiere cuidado

## Rollback Plan
- Cada fase crea TABLAS NUEVAS (no modifica existentes destructivamente)
- Columnas nuevas tienen DEFAULT values — no rompen código existente
- Nuevos módulos son aditivos — si fallan, se desactivan sin afectar lo existente
- Git tags antes de cada fase para rollback rápido
