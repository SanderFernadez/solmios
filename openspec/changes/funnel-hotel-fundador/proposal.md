# Change Proposal: funnel-hotel-fundador

## Summary

Completar los flujos de **backend** del embudo de captación de Hoteles Fundadores
(`frontend/src/pages/hotel-fundador/index.vue`), cuyo frontend ya está 100%
implementado según el PRD `frontend/embudolamding.md`.

El frontend entrega los 7 bloques visuales + calculadora + FAQ + barra sticky +
footer, pero actualmente es una **pantalla estática sin persistencia ni
automatización**: el formulario solo setea `submitted = true` en memoria, el
contador de cupos está hardcodeado, y no existe correo automático, flujo
WhatsApp, ni página de gracias tras pago.

## Motivation

El PRD es explícito en varias reglas no negociables que hoy NO se cumplen:

> "Nunca puede ser falso. Debe alimentarse automáticamente desde la base de
> datos o pasarela de pago." (Sección 5 — Contador)

> "Debe enviarse inmediatamente." (Correo Automático)

> "Debe iniciarse en menos de cinco minutos." (Flujo WhatsApp)

Un contador de cupos hardcodeado (`slotsTaken = 3`) viola la regla de
veracidad del PRD y expone a la marca a reclamos legales/comerciales si un
Fundador reserva y el contador no baja. Sin persistencia de leads, cada envío
del formulario se pierde.

## Scope

### DONE — Frontend (no se toca, referencia)

- `frontend/src/pages/hotel-fundador/index.vue` — 7 secciones del PRD ✅
- `frontend/src/pages/landing/index.vue:30-36` — botón header → `/hotel-fundador` ✅
- Router `/hotel-fundador` registrado (`router/index.ts:14`) ✅
- Mismo lenguaje visual que landing principal (Playfair Display + DM Sans,
  paleta navy/teal/gold/blue/coral, animación `hero-fade-up`, navbar frosted) ✅

### In Scope — Backend (este change)

1. **Persistencia de leads** — tabla `founder_leads` + endpoint POST + validación
2. **Contador de cupos real** — alimentado desde `founder_leads` (status=paid) o Stripe
3. **Lista de espera** — persistencia segmentada para países no soportados
4. **Correo automático** — email inmediato post-envío (confirmación + siguiente paso)
5. **Flujo WhatsApp** — 4 mensajes automatizados de calificación (bloqueado por Meta)
6. **Página de Gracias** — Caso 1 (formulario) y Caso 2 (pago con depósito)
7. **Integraciones de marketing** — Pixel Meta, GA4, GTM, CRM

### Out of Scope

- Rediseño del frontend (ya cumple el PRD visualmente)
- Cambios al landing principal `/`
- Sistema de facturación de la suscripción SaaS (eso es `plans` / super-admin)
- App móvil (repo `solmios-mobile`)

## Approach

```
Fase 1 (Persistencia leads)  ──┐
Fase 2 (Contador real)       ──┤  sin dependencias externas → desbloquea veracidad
Fase 3 (Lista de espera)     ──┘
        │
Fase 4 (Correo automático)   ── usa EmailService existente (SMTP/Resend)
        │
Fase 5 (Página de Gracias)   ── Caso 1 sin pago / Caso 2 con depósito Stripe
        │
Fase 6 (WhatsApp Business)   ── BLOQUEADO por verificación Meta
        │
Fase 7 (Marketing/Analytics) ── tags sin dependencias externas críticas
```

## Risks

- **WhatsApp Business API**: requiere verificación de negocio por Meta (1-2
  semanas). Igual que `match-misterplan/phase-7-whatsapp`. Fase 6 queda
  `blocked-external`.
- **Stripe para depósito Fundador**: la plataforma ya tiene Stripe (links,
  deposits, checkout sessions) pero el producto "Programa Hotel Fundador" no
  existe como Price en Stripe. Requiere crear el Price + mapear a cupos.
- **Contador veraz**: si se cuenta por `founder_leads.status='paid'` pero el
  pago se procesa fuera del sistema (transferencia), el contador no baja hasta
  marca manual. Documentar canal de conciliación.

## Rollback Plan

- Fases 1-3 son **aditivas** (nueva tabla `founder_leads`, nuevos endpoints).
  Rollback = drop tabla + remover rutas, sin afectar PMS.
- Fase 4 (email) es un worker nuevo sobre `email_queue` existente; se desactiva
  con flag de configuración.
- Fases 5-7 no tocan código crítico del PMS; rollback aislado.

## Referencia MisterPlan

Equivalencia N/A — este embudo de ventas NO existe en MisterPlan (es un PMS,
no captación de fundadores). Es funcionalidad propia de SOLMI OS go-to-market.
