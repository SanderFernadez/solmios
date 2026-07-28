# Menu Featured & Availability Specification (F6)

## Purpose

Permitir marcar un ítem como destacado ("plato del día"/recomendado) y restringir su
disponibilidad a una franja horaria (desayuno/almuerzo/cena) — fuera de esa franja, el
ítem no debe poder agregarse a una comanda ni aparecer como disponible en el POS. Dominio
NUEVO — columnas nullable en `menu_items`, sin tabla nueva.

**Alcance frente al `available` existente**: hoy `menu_items.available` (boolean,
`model.ts:50`) es un toggle manual — "86'd", el admin lo agota/reactiva a mano
(`setAvailability` en `items-crud.ts:120-129`, botón "Agotar"/"Reactivar" en
`carta.vue:375`). F6 agrega una SEGUNDA condición de disponibilidad, automática y basada
en la hora: un ítem puede tener `available=1` (no agotado manualmente) y aun así estar
fuera de servicio porque no es su franja horaria. Ambas condiciones son independientes y
se combinan con AND: disponible = `available=1` AND dentro de franja (si tiene franja
configurada).

**Corrección/nota de alcance sobre la hora usada**: el único precedente de comparación de
horario en el código (`attendance/usecases/clock.ts:43-47`) usa
`new Date().getHours()/getMinutes()` — hora del SERVIDOR, no `hotel.timezone`-aware (la
tabla `hotels` sí tiene `timezone`, pero ningún módulo la usa hoy para esto). Este spec
sigue el MISMO criterio ya establecido (no introduce conversión de zona horaria nueva que
no existe en ningún otro lado del código) — queda como deuda conocida y compartida con
`attendance` si el hotel opera en un huso horario distinto al del servidor de producción,
no una regresión nueva de F6.

**Gap detectado, fuera de alcance de este spec**: `menu-combos/spec.md` (F2) no valida
`item.available` al explotar un combo en header+componentes — el chequeo de disponibilidad
en `order-lines.ts:65` (`if ((item.available ?? 1) === 0) throw ...`) solo corre en el
camino de ítem suelto (`dto.menuItemId`), no en el camino de combo (`dto.comboId`,
descripto en F2). Por lo tanto, un combo con un componente fuera de horario (F6) o agotado
manualmente HOY se seguiría vendiendo sin bloqueo por ese camino — F2 ya está completo y
no se toca acá; este spec deja el chequeo de franja horaria en el mismo lugar donde ya
vive el chequeo de `available` (el ítem suelto), y señala el gap de combos como deuda
técnica a trackear aparte (mismo criterio que `openspec/changes/deudas-tecnicas-pendientes`),
no como algo que F6 deba resolver silenciosamente ampliando su propio alcance.

## Requirements

### Requirement: Ítem destacado

El sistema MUST permitir marcar un ítem como `featured` (boolean/number 0-1, default 0).
No tiene ninguna regla de negocio asociada — es puramente informativo para resaltarlo en
la UI (Carta, Comanda, carta pública).

#### Scenario: Marcar el plato del día

- GIVEN "Risotto de hongos"
- WHEN el admin lo marca `featured: true`
- THEN el ítem aparece destacado en Carta, Comanda y la carta pública (F7)

### Requirement: Franja horaria de disponibilidad

El sistema MUST permitir configurar `availableFrom`/`availableTo` (string `"HH:mm"`,
mismo formato que `mantenimiento/model.ts:85-87` `workStart`/`workEnd`) en un ítem. Ambos
`null` (default) MUST significar "sin restricción horaria" — disponible todo el día,
comportamiento IDÉNTICO al actual para los ~ítems existentes (compat retro total).

Un ítem con franja horaria configurada MUST considerarse disponible solo si la hora
actual del servidor está entre `availableFrom` y `availableTo` (inclusive). Una franja
que cruza medianoche (ej. `availableFrom: "22:00"`, `availableTo: "02:00"`, menú de
madrugada) MUST evaluarse como `hora >= availableFrom OR hora <= availableTo`.

#### Scenario: Ítem de desayuno fuera de horario

- GIVEN "Pancakes" con `availableFrom: "07:00"`, `availableTo: "11:00"`
- WHEN son las 14:00
- THEN el ítem se considera NO disponible aunque `available=1`

#### Scenario: Ítem de desayuno dentro de horario

- GIVEN el mismo ítem
- WHEN son las 09:00
- THEN el ítem se considera disponible

#### Scenario: Franja que cruza medianoche

- GIVEN "Pizza nocturna" con `availableFrom: "22:00"`, `availableTo: "02:00"`
- WHEN son las 00:30
- THEN el ítem se considera disponible (dentro del rango que cruza medianoche)
- WHEN son las 15:00
- THEN el ítem se considera NO disponible

### Requirement: Fuera de horario bloquea agregar la línea

El usecase `addLine` (`order-lines.ts:61-86`) MUST rechazar con `ValidationError` agregar
un ítem fuera de su franja horaria, con el mismo criterio y en el mismo punto donde hoy
rechaza `available=0` (línea 65) — la validación de franja se agrega junto a esa,
no reemplaza el chequeo existente.

#### Scenario: Intentar vender fuera de horario

- GIVEN "Pancakes" (franja 07:00-11:00) y son las 20:00
- WHEN el mesero intenta agregarlo a una comanda
- THEN el sistema responde 400 (`""Pancakes" no está disponible en este horario"`)
- AND la línea NO se crea

### Requirement: Snapshot ya vendido no se ve afectado retroactivamente

Una línea de comanda YA creada MUST conservar su snapshot (`name`, `unitPrice`, etc.) sin
importar que el ítem salga de su franja horaria después — mismo principio de snapshot ya
establecido por F1 (modificadores) y F2 (combos): la comanda no muta si la carta cambia
después de vendida.

#### Scenario: El horario se cierra mientras el plato se está preparando

- GIVEN una línea de "Pancakes" agregada a las 10:55 (dentro de franja)
- WHEN da la hora 11:00 y el ítem sale de franja mientras la línea sigue `preparing` en
  el KDS
- THEN la línea sigue visible y avanzando normalmente en el KDS — la franja horaria solo
  bloquea AGREGAR líneas nuevas, nunca oculta ni cancela una ya en curso

## Database

- **MODIFIED TABLE** `menu_items`
  | Column | Type | Nullability | Notes |
  |---|---|---|---|
  | `featured` | number (0/1) | default `0` | destacado/plato del día, sin regla de negocio asociada |
  | `availableFrom` | string | nullable | `"HH:mm"`. `null` = sin restricción horaria (default, compat retro) |
  | `availableTo` | string | nullable | `"HH:mm"`. `null` = sin restricción horaria |

## API

`CreateItemSchema`/`UpdateItemSchema` se EXTIENDEN:

```
featured?: number        // type: 'number', 0 o 1
availableFrom?: string   // type: 'string', formato "HH:mm" validado en el usecase
availableTo?: string     // type: 'string', formato "HH:mm" validado en el usecase
```

El usecase `createItem`/`updateItem` (`items-crud.ts`) MUST validar el formato `HH:mm`
(`assertTimeWindow`, mismo estilo que `assertPrice`/`assertTaxRate`) y rechazar si viene
solo uno de los dos campos (`availableFrom` sin `availableTo` o viceversa) — la franja es
todo-o-nada, no tiene sentido un límite sin el otro.

`order-lines.ts` (`addLine`) agrega la función `isWithinAvailabilityWindow(item, now)`
(nueva, en el mismo archivo o en `order-totals.ts` junto a `resolveStation`/`round2`) y la
llama inmediatamente después del chequeo de `available` existente (línea 65).

`GET /api/restaurant/menu-items` MUST agregar un campo derivado `availableNow: boolean`
en cada DTO (`available=1` AND dentro de franja si tiene una configurada) para que el
frontend no reimplemente la lógica de franja horaria — el cálculo vive en un solo lugar
(backend), el frontend solo lee el booleano.

## UI

- En `carta.vue`, el editor de ítem agrega: checkbox "Destacado" y dos campos de hora
  (`availableFrom`/`availableTo`, con opción "Sin restricción" que los deja `null`).
- Un ítem destacado se muestra con una estrella/badge dorado en la lista de Carta, en
  Comanda y en la carta pública.
- Un ítem fuera de su franja horaria actual se muestra atenuado (opacity reducida) en
  Carta con el texto "Fuera de horario (07:00-11:00)", distinto visualmente del badge rojo
  "Agotado" (son dos causas distintas de no-disponibilidad).
- En `comanda.vue`, `availableItems` (línea 48-49, hoy `items.value.filter((i) =>
  i.available !== 0)`) se actualiza para además filtrar por `i.availableNow !== false` —
  un ítem fuera de horario simplemente no aparece en la lista para agregar, sin necesidad
  de que el mesero sepa por qué.
- La carta pública (F7) muestra el ítem igual (para que el huésped vea el menú completo
  del hotel, no solo lo que hay ahora mismo) pero con la leyenda "Disponible de 07:00 a
  11:00" en vez de ocultarlo — ver `menu-public/spec.md`, que decide mostrar informativamente
  los ítems fuera de franja en vez de ocultarlos del todo.
