# Archive Report — carta-experiencia-avanzada

**Archivado**: 2026-07-27

## Resultado

Change completo: 8 fases (F1-F8) + F0 (infraestructura compartida, hallazgo de la fase de diseño)
implementadas, verificadas por tests, verificadas por `sdd-verify` adversarial (26 escenarios
contra código real), y verificadas visualmente en el navegador (login real, creación de un combo
de prueba, carta pública sin sesión). Veredicto de `verify-report.md`: LISTO CON OBSERVACIONES
MENORES, ambas resueltas antes de archivar.

## Specs fusionadas a `openspec/specs/`

Primera vez que este proyecto usa `openspec/specs/` como fuente de verdad de dominio — no había
specs previas que fusionar, así que cada spec delta se copió tal cual como el spec principal
inicial de su dominio:

- `openspec/specs/menu-modifiers/spec.md` (F1)
- `openspec/specs/menu-combos/spec.md` (F2)
- `openspec/specs/menu-food-cost/spec.md` (F3)
- `openspec/specs/menu-i18n/spec.md` (F4)
- `openspec/specs/menu-allergens/spec.md` (F5)
- `openspec/specs/menu-featured-availability/spec.md` (F6)
- `openspec/specs/menu-public/spec.md` (F7)
- `openspec/specs/menu-ordering/spec.md` (F8)

## Deuda derivada, ya trackeada

- **DT-10** (`openspec/changes/deudas-tecnicas-pendientes/`): combo no valida disponibilidad/franja
  horaria de sus componentes al explotarse. Aceptada como deuda de alcance de esta v1, no
  bloqueante, con tasks propias (10.1-10.3) para cuando se decida priorizarla.

## Lineage (MemoryOne, project `arckode-studio`)

| Artefacto | topic_key | id |
|---|---|---|
| proposal | `sdd/carta-experiencia-avanzada/proposal` | 2238 |
| spec | `sdd/carta-experiencia-avanzada/spec` | 2239 |
| design | `sdd/carta-experiencia-avanzada/design` | 2240 |
| tasks | `sdd/carta-experiencia-avanzada/tasks` | 2241 |
| verify-report | `sdd/carta-experiencia-avanzada/verify-report` | 2246 |

## Verificación técnica final (al momento de archivar)

- `arckode analyze`: ✅ VÁLIDO, 0 violaciones
- `bun test` (backend): 2101 pass / 0 fail
- `bun run typecheck` (backend): 0 errores nuevos (9 pre-existentes ajenos en scripts de tooling)
- `bun run typecheck && bun run build` (frontend): 0 errores, build OK
- Verificación visual en navegador: F1-F8 confirmadas funcionando, incluida la carta pública sin
  sesión (`/menu/:hotelId`) sin exponer ningún dato de costo/receta/insumo
