# SolmiOS — Design System (panel administrativo)

> Referencia visual del panel `/panel/*` (hotel admin), derivada del código real — no del mockup de marketing en `designs/index.html` (esa página es una landing comercial vieja, con emojis y paleta `gray-50`, y **no** representa el diseño actual del panel; ignorarla como fuente de estilo).
>
> Objetivo de este documento: que cualquier IA o dev pueda construir una pantalla nueva citando estos patrones y archivos, sin re-inventar estilos.

## 1. Tokens base — `frontend/src/styles/main.css`

Todo color/sombra/fuente sale de acá (`@theme` de Tailwind 4, variables CSS nativas). **Nunca hardcodear un hex que ya tiene nombre acá.**

```css
--color-navy: #0D2B4E        --color-navy-light: #1A3A5C
--color-blue: #1D67E3        --color-cyan: #00B4D8   --color-cyan-light: #48CAE4
--color-teal: #117A65        --color-teal-light: #1ABC9C
--color-purple: #6C3483      --color-purple-light: #8E44AD
--color-gold: #B7950B        --color-gold-light: #D4AC0D
--color-coral: #E74C3C       --color-coral-light: #EC7063
--color-surface: #F8FAFC     --color-surface-dark: #F1F5F9   /* fondo de página, NO tarjetas */
--color-border: #E2E8F0
--color-text: #1E293B        --color-text-secondary: #64748B  --color-text-muted: #94A3B8
--color-success: #10B981     --color-warning: #F59E0B  --color-danger: #EF4444

--font-sans: 'DM Sans', 'Inter', -apple-system, ...   /* cargado en index.html via Google Fonts */

--shadow-card: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)   /* usar como `shadow-(--shadow-card)` en Tailwind 4 */
--shadow-card-hover: 0 4px 16px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.1)
--shadow-nav: 0 1px 8px rgba(0,0,0,0.06)
```

Uso Tailwind directo: `bg-navy`, `text-teal`, `border-coral/20`, `shadow-(--shadow-card)`. Los "accent colors" del sistema son solo estos 7: **navy, cyan, teal, purple, gold, coral** (+ `blue` para casos puntuales tipo Google). No introducir colores nuevos fuera de este set salvo que sea un logo de marca externa (ver §7).

**Regla de oro de fondo**: `bg-surface` (#F8FAFC) es el fondo de PÁGINA, no de tarjeta. Una tarjeta sobre `bg-surface` casi siempre debe ser `bg-white`, o se ve "gris sucio" — error ya cometido y corregido una vez en `ReservationModal.vue` (ver memoria `reservationmodal-restyle-planning-grid-legend-fix`).

## 2. Layout raíz — `frontend/src/layouts/AdminLayout.vue`

- `<div class="flex min-h-screen bg-surface">` — shell de toda página `/panel/*`.
- **Sidebar** (`aside.cc-sidebar`, ~línea 19): dark, degradé navy casi negro (no es `bg-navy` plano — ver clase `.cc-sidebar` al final del archivo), texto `#C4C8D0`, ítem activo `bg-[#2563EB]/20 text-white`, ícono activo `text-[#60A5FA]`. Widget de "Ocupación Hoy" con anillo SVG embebido dentro del propio nav (línea 63-90) — patrón de anillo de progreso reutilizado también en KPI cards (§4).
- **Header superior**: sin `border-b` duro, solo `shadow-nav`; pills/buscador `rounded-full` sin borde. (Decisión: `[[Header global: quitado buscador y chip de hotel]]` en memoria — no readerlos.)
- Página real se monta en el `<router-view>` con padding propio de cada page (`p-6` típico, dashboard usa `-m-6 p-5` para compensar y controlar su propio fondo con gradiente, ver §4).

## 3. Dos lenguajes visuales conviven — elegir el correcto según la pantalla

| Contexto | Lenguaje | Dónde |
|---|---|---|
| Dashboard (`/panel/dashboard`) | **"Command Center"**: fondo con radial-gradients sutiles, cards con degradé + glow blobs + animación, números gigantes animados, anillos SVG | `pages/dashboard/index.vue` + `components/features/dashboard/*.vue` |
| Todo lo demás (planning, reservations, guests, billing, rooms, modales…) | **"Operational flat"**: tarjetas blancas planas, borde `border-border/70`, acento de color solo como borde izquierdo 3px + icon-chip, sin degradés ni glow | `pages/planning/index.vue`, `pages/reservations/index.vue`, `components/features/ReservationModal.vue` |

**No mezclar los dos.** Un formulario/lista operativo con glow+degradé se va a ver fuera de lugar; un dashboard con tarjetas planas sin vida pierde el efecto "centro de mando" que el dashboard busca. Si la pantalla nueva es un listado/CRUD → lenguaje operativo. Si es un panel de métricas en vivo → Command Center.

## 4. Command Center — patrones del dashboard

Archivo maestro: `pages/dashboard/index.vue`. Compone 9 sub-componentes en `components/features/dashboard/`:

| Componente | Qué es | Patrón clave |
|---|---|---|
| `CommandCenterHeader.vue` | Franja superior con foto de hotel + pills de estado | Fondo casi negro `linear-gradient(180deg,#0C1830,#0A1426)` + radial glow, clase `.cc-status-card`; cada indicador es un `.cc-pill` (dot pulsante `animate-ping` + label uppercase 9px + valor 12px black + sub 10px) |
| `KpiHeroCard.vue` | Las 4 tarjetas grandes de KPI (Ocupación/Check-in/Check-out/Ingresos) | Card `rounded-[16px]` con **gradiente por acento** (`THEMES.blue/green/purple/amber`, línea 101-122) + 2 blobs `blur-3xl` decorativos + anillo de progreso SVG (`stroke-dasharray` animado) + número gigante `text-[clamp(34px,2.7vw,50px)]` con **count-up animado** (`useCountUp`) + sparkline opcional + fila de sub-stats |
| `ReservationsGantt.vue` | Calendario de reservas del dashboard | Barras coloreadas por **estado** (`STATUS_COLOR`, hex directo, no Tailwind), con badge circular de canal (ver §7) |
| `HotelStatusPanel.vue` | Lista "Estado del Hotel" | Card blanca simple `rounded-[20px] border-border shadow-(--shadow-card)`, filas con pill de estado `background:${color}1A` (alpha hex) + dot pulsante si `tone==='ok'|'sync'` |
| `AiInsightsPanel.vue` | Panel de IA con avatar | Card blanca con 1 blob glow sutil, avatar PNG (`assets/RobotoIADashboard.png`), lista de insights con ícono circular por `tone` (ok/warn/danger/info → verde/ámbar/rojo/cian) |
| `RevenueChart.vue`, `ChannelDistributionBars.vue`, `RoomsStatusDonut.vue`, `LiveActivityFeed.vue`, `FloorHeatMap.vue` | Métricas secundarias | Mismo patrón de card blanca `rounded-[20px]` + `shadow-(--shadow-card)`; no llevan gradiente/glow (eso queda reservado a las 4 KPI hero cards y el header, para que no compitan visualmente) |

**Cuándo usar glow/gradiente vs. card blanca plana dentro del dashboard**: solo el header y las 4 KPI cards llevan degradé+glow (son el "titular" de la pantalla). Todo lo demás dentro del dashboard es card blanca plana `rounded-[20px] border-border shadow-(--shadow-card)` — mismo lenguaje que el resto del panel, para no saturar.

Fondo de página del dashboard: no es `bg-surface` puro, tiene 2 radial-gradients muy sutiles superpuestos (`.cc-dashboard` en `pages/dashboard/index.vue` línea 581-586) — replicar esa clase si se agrega una pantalla "tipo Command Center" nueva.

## 5. Operational flat — patrón de tarjeta (el más usado en todo el resto del panel)

Ejemplo canónico: `components/features/ReservationModal.vue` líneas 407-411 (tras el rediseño de esta sesión) y `pages/planning/index.vue`.

```html
<div class="bg-white border border-border/70 border-l-[3px] border-l-{color}/60 rounded-2xl shadow-card overflow-hidden">
  <div class="flex items-center gap-2 p-4 font-black text-sm text-navy">
    <span class="w-7 h-7 rounded-lg bg-{color}/10 flex items-center justify-center text-{color}">
      <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">...</svg>
    </span>
    Título de la sección
  </div>
  <div class="px-4 pb-4 pt-1 space-y-2 text-sm"> ...filas label/value... </div>
</div>
```

Reglas:
- **Nunca** `bg-{color}/5` como fondo de card completa (se ve "gris sucio" sobre `bg-surface`, ver §1). El color entra SOLO por: (a) borde izquierdo 3px, (b) icon-chip 28px `rounded-lg bg-{color}/10 text-{color}`.
- Radio: `rounded-2xl` (16px) para tarjetas de sección, `rounded-[20px]` para el panel completo de un modal, `rounded-full` para pills/botones.
- Filas internas: `<div class="flex justify-between gap-3"><span class="text-text-muted">Label</span><span class="font-bold text-right">Valor</span></div>`.
- Fila que necesita destacarse (ej. fechas de check-in/out): envolver en `bg-{color}/8 rounded-xl px-3 py-2` — único caso donde SÍ se usa color de fondo, para una sola fila puntual, no la card entera (ver `ReservationModal.vue` fila "Entrada – Salida").
- Cajas anidadas dentro de una card ya blanca (para dar contraste sin volver a usar color): `bg-surface rounded-lg p-2 border border-border/70`.

## 6. Modales — estructura estándar de 3 bloques

Referencia: `components/features/ReservationModal.vue` (vista) y `pages/reservations/index.vue` (formulario "Nueva/Editar Reserva", líneas ~212-624 tras el rediseño de esta sesión — **es la versión canónica del wizard**, `pages/planning/index.vue` tiene una réplica simplificada del mismo modal para uso dentro del calendario).

```
┌─ Header: p-5, bg-gradient-to-r from-navy to-navy/90, border-b border-border ─┐
│  Título text-lg font-black text-white + badges bg-white/15 text-white pills │
│  Botón cerrar: w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20             │
│  Si es wizard: stepper numerado (ver abajo)                                 │
├─ Body: flex-1 overflow-y-auto, p-5, contenido en cards operational flat ────┤
├─ Footer: p-4/5 border-t border-border, flex justify-between ────────────────┤
│  Izq: "Total: $X" con icon-chip navy opcional                               │
│  Der: Cancelar (border rounded-xl) · Atrás (border rounded-xl) ·            │
│        Siguiente (bg-navy rounded-xl) · Acción final (bg-teal rounded-xl)   │
└───────────────────────────────────────────────────────────────────────────┘
```

Overlay: `bg-navy/40 backdrop-blur-sm` (nunca negro sólido). Panel: `bg-white rounded-[20px] shadow-2xl`.

**Stepper numerado** (wizard de varios pasos) — patrón fijado esta sesión, usar SIEMPRE esta forma, no la barra fina vieja:
```html
<span class="text-[11px] font-bold text-white/70">Paso {{n}} de {{total}}</span>
<div class="mt-2 flex items-center">
  <button v-for="step in STEPS" class="w-6 h-6 rounded-full text-[11px] font-black"
    :class="step.n === current ? 'bg-cyan text-navy' : step.n < current ? 'bg-white text-navy' : 'bg-white/15 text-white/60'">
    <svg v-if="step.n < current" ...checkmark.../><span v-else>{{step.n}}</span>
  </button>
  <div class="flex-1 h-px mx-1.5" :class="step.n < current ? 'bg-white/60' : 'bg-white/20'"></div>
</template>
```
Ver implementación completa en `ReservationModal.vue` (~línea 384-395) y `pages/reservations/index.vue` (~línea 229-238).

## 7. Íconos

- **Sistema general**: SVG inline outline, `stroke="currentColor" stroke-width="2"`, `viewBox="0 0 24 24"`, tamaño típico `h-3.5 w-3.5` a `h-5 w-5`. Nunca emoji en el panel admin (regla aplicada consistentemente esta sesión — se removieron emojis de `ReservationModal.vue`, `ReservationsGantt.vue`, `planning/index.vue` en sesiones previas). Los emojis SÍ aparecen todavía en `pages/dashboard/index.vue` (`ACTIVITY_META`, insights) — **deuda pendiente, no replicar en pantallas nuevas**, usar SVG.
- **Logos de marca (OTAs/canales de reserva)**: `frontend/src/composables/useChannelBrand.ts` — `getChannelBrand(key)` devuelve `{label, icon, color}` para direct/booking/expedia/airbnb/google/agoda/trip/despegar/hostelworld/whatsapp/phone. Los SVG son de `simple-icons` (ya en `package.json`), verbatim iguales a los de `pages/channel-manager/index.vue`. **Siempre importar de acá, nunca volver a pegar el SVG de un logo a mano.**
  - En superficies donde el fondo YA puede ser el color del canal (ej. barra de planning en modo "Por Canal"): chip blanco + ícono con `color: brand.color`.
  - En superficies donde el fondo NUNCA es color de canal (ej. barra del dashboard, coloreada por estado): chip de fondo `background: brand.color` + ícono blanco (`text-white`).
- **Icon-chip de sección** (ver §5): cuadrado `w-7 h-7 rounded-lg bg-{color}/10 text-{color}`, ícono adentro `h-3.5 w-3.5`.

## 8. Badges / pills / estados

- Pill genérica: `text-[10px] font-bold px-2.5 py-1 rounded-full`.
- Sobre fondo navy (headers de modal): `bg-white/15 text-white` + ícono, NUNCA `bg-{color}/10 text-{color}` (ilegible sobre navy — bug corregido esta sesión en `ReservationModal.vue`).
- Sobre fondo blanco: `bg-{color}/10 text-{color}`.
- Dot de estado "en vivo": `<span class="relative flex h-1.5 w-1.5"><span class="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 bg-{color}"></span><span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-{color}"></span></span>` — usado en "En vivo" de toolbars y en pills de estado del Command Center.
- **Colores de estado de reserva** (consistentes en TODO el panel, no reinventar): `pending`→gold/amber, `confirmed`→teal o cyan (varía por pantalla, ver archivo), `checked_in`→cyan o teal, `checked_out`→purple, `cancelled`→coral. Ver `pages/planning/index.vue` `ST_COLOR` y `components/features/dashboard/ReservationsGantt.vue` `STATUS_COLOR` para los valores exactos vigentes por pantalla (no son 100% idénticos entre sí — normalizar si se toca de nuevo).
- **Fuente de verdad del status normalizado**: `frontend/src/services/Reservation.service.ts` exporta `STATUS_MAP` (normaliza `pendiente/confirmada/checkout` español-crudo → `pending/confirmed/checked_out` inglés). Cualquier pantalla nueva que lea `reservation.status` de una respuesta cruda de API (no pasada por `mapReservation()`) DEBE pasarlo por `STATUS_MAP` antes de mapear a color, o el color sale mal silenciosamente (bug real encontrado y corregido en `planning/index.vue` esta sesión).

## 9. Botones

| Tipo | Clase | Uso |
|---|---|---|
| Primario | `bg-navy text-white rounded-xl font-bold hover:bg-navy-light` | Siguiente, acción principal |
| Éxito/confirmación final | `bg-teal text-white rounded-xl font-black hover:opacity-90` | Crear/Guardar/Confirmar |
| Peligro | `bg-coral text-white rounded-lg font-bold` (o `/90` de opacidad) | Anular/Cancelar/Eliminar |
| Secundario | `border border-border rounded-xl text-text-secondary hover:bg-surface` | Cancelar, Atrás |
| Sobre navy (header modal) | `bg-white/10 text-white hover:bg-white/20 rounded-lg` | Imprimir, cerrar (ícono) |
| Pill de navegación (toolbar) | `rounded-full` en vez de `rounded-xl` | Filtros, tabs de vista |

Radio: `rounded-xl` es el default de botón de acción; `rounded-full` se reserva para pills/toggles/tabs. No mezclar ambos para el mismo tipo de control en una misma pantalla (fue el fix de esta sesión en `pages/reservations/index.vue`: se pasó de `rounded-full` a `rounded-xl` en los botones del modal para igualar `planning/index.vue`).

## 10. Tipografía

- Familia: DM Sans / Inter (cargadas globalmente, no declarar font-family manualmente).
- Pesos: `font-bold` (700) para labels/valores normales, `font-black` (900) para títulos y números destacados, `font-extrabold` (800) como punto medio ocasional.
- Labels de campo: `text-[10px]` o `text-[11px] font-bold uppercase tracking-wide text-text-muted`.
- Números gigantes (KPI): `text-[clamp(34px,2.7vw,50px)] font-black tabular-nums` — usar `tabular-nums` en CUALQUIER número que cambie dinámicamente (evita jitter de layout).

## 11. Antes de construir una pantalla nueva

1. ¿Es dashboard/métricas en vivo o CRUD/listado? → elegir lenguaje visual (§3).
2. Copiar la estructura de card más parecida de §4 o §5, no escribir clases desde cero.
3. Si hay reservas/canales: importar `useChannelBrand.ts`, no inventar íconos de OTA.
4. Si hay wizard: copiar el stepper numerado de §6, no la barra de progreso vieja.
5. Si hay badges de estado de reserva: pasar el status por `STATUS_MAP` de `Reservation.service.ts` si viene de API cruda.
6. Verificar con `bun run typecheck` en `frontend/` antes de dar por terminado.

## Changelog de este documento

Escrito 2026-07-13 tras una sesión de rediseño que tocó: `ReservationModal.vue`, `pages/planning/index.vue`, `pages/reservations/index.vue`, `components/features/dashboard/ReservationsGantt.vue`, y creó `composables/useChannelBrand.ts`. Ver memoria del proyecto (`manager-hotel/frontend/reservations/design-system`, `manager-hotel/frontend/planning/design-system`) para el detalle histórico de cada decisión.
