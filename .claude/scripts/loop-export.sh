#!/usr/bin/env bash
# loop-export.sh — Instalar LOOP en un proyecto destino, LIMPIO.
#
# Es el camino recomendado para llevar LOOP a un proyecto nuevo o existente.
# Copia SOLO la plantilla (agentes, workflows, reglas, checklists, scripts, skill) y siembra
# el estado y el contexto desde `templates/pristine/` — nunca desde el estado de trabajo del
# proyecto de origen. Un `cp -r .claude` a mano hereda el plan, los issues y el tech-stack del
# proyecto anterior; este script existe para que eso no pase (LOOP-006).
#
# Uso:
#   .claude/scripts/loop-export.sh <destino> [--force]
#
#   --force   sobrescribe un .claude/ ya existente en el destino (hace backup antes)
#
# Después de exportar, en el destino:
#   .claude/scripts/loop-init.sh     # adopta y activa el enforcement
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PRISTINE="$SRC_ROOT/.claude/templates/pristine"

DEST=""
FORCE=0
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    -h|--help) sed -n '2,20p' "${BASH_SOURCE[0]}"; exit 0 ;;
    -*) printf '❌ opción desconocida: %s\n' "$arg" >&2; exit 2 ;;
    *) DEST="$arg" ;;
  esac
done

[ -n "$DEST" ] || { printf '❌ Falta el destino.\n   Uso: loop-export.sh <destino> [--force]\n' >&2; exit 2; }
[ -d "$PRISTINE" ] || { printf '❌ No encuentro %s — la plantilla de origen está incompleta.\n' "$PRISTINE" >&2; exit 1; }

mkdir -p "$DEST" 2>/dev/null || { printf '❌ No puedo crear %s\n' "$DEST" >&2; exit 1; }
DEST="$(cd "$DEST" && pwd)"

[ "$DEST" != "$SRC_ROOT" ] || { printf '❌ Origen y destino son el mismo proyecto.\n' >&2; exit 2; }

# ── Destino ya tiene LOOP: no pisar sin permiso ──────────────────────────────
if [ -e "$DEST/.claude" ] && [ "$FORCE" -eq 0 ]; then
  printf '❌ %s/.claude ya existe.\n' "$DEST" >&2
  printf '   Usá --force para sobrescribir (se hace backup antes), o elegí otro destino.\n' >&2
  exit 1
fi
if [ -e "$DEST/.claude" ]; then
  BK="$DEST/.claude.backup-$(date -u +%Y%m%dT%H%M%SZ)"
  mv "$DEST/.claude" "$BK" || { printf '❌ No pude respaldar el .claude existente.\n' >&2; exit 1; }
  printf 'ℹ️  .claude previo respaldado en %s\n' "$BK"
fi

mkdir -p "$DEST/.claude"

# ── 1. Partes de PLANTILLA: se copian tal cual ───────────────────────────────
# Son el "software" del sistema: mismo contenido en todo proyecto.
for d in agents workflows rules checklists templates skills scripts; do
  [ -d "$SRC_ROOT/.claude/$d" ] || continue
  cp -r "$SRC_ROOT/.claude/$d" "$DEST/.claude/$d"
done
for f in settings.json cronograma.md agent.config.md README.md ENFORCEMENT.md; do
  [ -f "$SRC_ROOT/.claude/$f" ] && cp "$SRC_ROOT/.claude/$f" "$DEST/.claude/$f"
done
[ -f "$SRC_ROOT/CLAUDE.md" ] && cp "$SRC_ROOT/CLAUDE.md" "$DEST/CLAUDE.md"

# El propio pristine no se anida dentro de sí mismo en el destino: ya viajó dentro de templates/.

# ── 2. ESTADO y CONTEXTO: siempre desde pristine, jamás del origen ───────────
# Ésta es la línea que separa "plantilla" de "trabajo". Es el fix de LOOP-006.
mkdir -p "$DEST/.claude/state" "$DEST/.claude/context"
cp "$PRISTINE/state/"*.md   "$DEST/.claude/state/"
cp "$PRISTINE/context/"*.md "$DEST/.claude/context/"

# ── 3. openspec: esqueleto vacío ─────────────────────────────────────────────
mkdir -p "$DEST/openspec/changes" "$DEST/openspec/specs"
cp "$PRISTINE/openspec/project.md" "$DEST/openspec/project.md"
[ -f "$SRC_ROOT/openspec/README.md" ]         && cp "$SRC_ROOT/openspec/README.md" "$DEST/openspec/README.md"
[ -f "$SRC_ROOT/openspec/changes/README.md" ] && cp "$SRC_ROOT/openspec/changes/README.md" "$DEST/openspec/changes/README.md"
[ -f "$SRC_ROOT/openspec/specs/README.md" ]   && cp "$SRC_ROOT/openspec/specs/README.md" "$DEST/openspec/specs/README.md"

# ── 4. Nada de estado de ejecución viaja ─────────────────────────────────────
rm -f "$DEST/.claude/state/ledger.jsonl" \
      "$DEST/.claude/state/.ledger.lock" \
      "$DEST/.claude/state/.compact-marker" \
      "$DEST/.claude/state/.maintenance" 2>/dev/null

chmod +x "$DEST/.claude/scripts/"*.sh 2>/dev/null

# ── 5. Verificación de que no se coló basura ─────────────────────────────────
leaked=0
for f in "$DEST/.claude/state/"*.md "$DEST/.claude/context/"*.md; do
  [ -f "$f" ] || continue
  if ! grep -q "sin completar\|sin detectar\|ninguna tarea activa\|sin issues\|sin desglose\|sin registros\|pendiente" "$f" 2>/dev/null; then
    printf '⚠️  %s no parece virgen — revisalo.\n' "$f" >&2
    leaked=1
  fi
done

printf '✅ LOOP exportado a %s\n' "$DEST"
printf '   Estado y contexto sembrados VÍRGENES (nada heredado del proyecto de origen).\n'
[ "$leaked" -eq 0 ] || printf '   ⚠️  Con advertencias arriba.\n'
printf '\n   Siguiente paso, desde %s:\n     .claude/scripts/loop-init.sh\n' "$DEST"
exit 0
