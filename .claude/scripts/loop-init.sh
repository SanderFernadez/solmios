#!/usr/bin/env bash
# loop-init.sh — Adopción del proyecto (manual, NO es hook).
#
# Hace dos cosas:
#   1. Siembra estado y contexto VÍRGENES si detecta que vienen heredados de otro proyecto.
#      (LOOP-006: copiar `.claude/` a mano arrastra el plan, los issues y el tech-stack ajenos.
#       Un proyecto recién adoptado creyendo tener abierta la tarea de otro es estado corrupto.)
#   2. Crea el ledger con entrada `adopted`. Sin ledger = no adoptado = guards inertes.
#
# Nunca destruye sin respaldar: lo que reemplaza va a .claude/state/.pre-init-<ts>/
#
# Uso:
#   .claude/scripts/loop-init.sh [--reset-state] [--dry-run]
#
#   Por defecto adopta el ledger SIN tocar state/ ni context/ — nunca destruye trabajo real.
#   --reset-state  si detecta state heredado (difiere de la plantilla virgen), lo reemplaza
#                  por vírgenes con backup en state/.pre-init-<ts>/. Confirmación explícita:
#                  el automático destruye trabajo real cuando LOOP se aplica sobre sí mismo
#                  (LOOP-009) o cuando un proyecto legítimo difiere de la plantilla.
#   --dry-run      informa qué haría y sale sin escribir nada
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/loop-lib.sh"

PRISTINE="$LOOP_ROOT/.claude/templates/pristine"
CONTEXT_DIR="$LOOP_ROOT/.claude/context"
RESET_STATE=0
DRY_RUN=0

for arg in "$@"; do
  case "$arg" in
    --reset-state) RESET_STATE=1 ;;
    --dry-run)     DRY_RUN=1 ;;
    -h|--help)    sed -n '2,22p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) printf '❌ opción desconocida: %s\n' "$arg" >&2; exit 2 ;;
  esac
done

if ! loop_have_jq; then
  printf '❌ falta jq. Instalalo antes de adoptar (sin jq no se puede escribir el ledger).\n' >&2
  exit 1
fi

if loop_is_adopted; then
  printf 'ℹ️  Ya adoptado: %s (no se hace nada).\n' "$LOOP_LEDGER"
  printf '   El estado NO se toca en un proyecto ya adoptado — sería destruir trabajo real.\n'
  exit 0
fi

# ── ¿El estado que hay es heredado o es trabajo real de este proyecto? ───────
# Detección DETERMINÍSTICA: se compara byte a byte contra la plantilla virgen.
# (Una heurística por strings da falsos negativos: el current_progress.md de otro proyecto
#  contiene "Estado: pendiente" y pasaría por virgen. Verificado, no supuesto.)
# Difiere del pristine, o es un archivo que el pristine no tiene (stray) => heredado.
inherited=0
inherited_files=""
_mark_inherited() {
  inherited=1
  inherited_files="$inherited_files
     - $1"
}
if [ -d "$PRISTINE" ]; then
  for dir_pair in "state:$LOOP_STATE_DIR" "context:$CONTEXT_DIR"; do
    kind="${dir_pair%%:*}"
    dir="${dir_pair#*:}"
    [ -d "$dir" ] || continue
    for f in "$dir"/*.md; do
      [ -f "$f" ] || continue
      base="$(basename "$f")"
      ref="$PRISTINE/$kind/$base"
      if [ ! -f "$ref" ]; then
        _mark_inherited "$kind/$base (no existe en la plantilla: stray de otro proyecto)"
      elif ! cmp -s "$f" "$ref"; then
        _mark_inherited "$kind/$base"
      fi
    done
  done
fi

if [ "$DRY_RUN" -eq 1 ]; then
  printf '— dry-run —\n'
  printf 'Raíz detectada: %s\n' "$LOOP_ROOT"
  if [ "$inherited" -eq 1 ]; then
    printf 'Se sembrarían VÍRGENES (con backup previo) estos archivos con contenido heredado:%s\n' "$inherited_files"
  else
    printf 'Estado y contexto ya lucen vírgenes: no se tocarían.\n'
  fi
  printf 'Se crearía el ledger en: %s\n' "$LOOP_LEDGER"
  exit 0
fi

# ── Sembrar vírgenes, respaldando lo que se reemplaza ────────────────────────
# Solo con --reset-state explícito. Por defecto NO se toca state/context: destruiría
# trabajo real cuando LOOP se aplica sobre sí mismo o cuando un proyecto legítimo difiere
# de la plantilla (LOOP-009). El automático es un modo de falla letal: apagaría el sistema.
did_reset=0
if [ "$inherited" -eq 1 ] && [ "$RESET_STATE" -eq 1 ]; then
  did_reset=1
  BK="$LOOP_STATE_DIR/.pre-init-$(date -u +%Y%m%dT%H%M%SZ)"
  mkdir -p "$BK/state" "$BK/context" 2>/dev/null
  cp "$LOOP_STATE_DIR"/*.md "$BK/state/" 2>/dev/null
  cp "$CONTEXT_DIR"/*.md    "$BK/context/" 2>/dev/null

  # Los strays (archivos del proyecto de origen que no son parte de la plantilla) también salen.
  # Se barren AMBOS directorios, no solo state/ — un context/ ajeno es igual de tóxico.
  rm -f "$LOOP_STATE_DIR"/*.md "$CONTEXT_DIR"/*.md 2>/dev/null
  cp "$PRISTINE/state/"*.md   "$LOOP_STATE_DIR/"
  cp "$PRISTINE/context/"*.md "$CONTEXT_DIR/"
  [ -f "$PRISTINE/openspec/project.md" ] && [ -d "$LOOP_ROOT/openspec" ] && \
    cp "$PRISTINE/openspec/project.md" "$LOOP_ROOT/openspec/project.md"

  printf '🧹 Estado heredado reemplazado por versión virgen (--reset-state):%s\n' "$inherited_files"
  printf '   Respaldo completo en: %s\n' "$BK"
elif [ "$inherited" -eq 1 ]; then
  printf '⚠️  Estado heredado detectado (difiere de la plantilla virgen):%s\n' "$inherited_files"
  printf '   NO se resetea — podría ser trabajo real. Ledger adoptado sin tocar state/.\n'
  printf '   Para resetear a vírgenes (con backup): .claude/scripts/loop-init.sh --reset-state\n'
  printf '   Para inspeccionar antes:               .claude/scripts/loop-init.sh --dry-run\n'
fi

host="$(hostname 2>/dev/null || echo unknown)"
user="${USER:-${USERNAME:-unknown}}"

# `state_reset` refleja lo que REALMENTE pasó (did_reset), no lo que se detectó (inherited).
# Registrar el reset detectado en vez del ejecutado haría mentir al ledger — la fuente de verdad
# no puede afirmar una acción que no ocurrió. `inherited_detected` deja rastro de que había
# estado ajeno aunque no se haya tocado, para auditoría.
if loop_append adopted "host=$host" "user=$user" "state_reset=$did_reset" "inherited_detected=$inherited"; then
  printf '✅ Proyecto adoptado. Ledger: %s\n' "$LOOP_LEDGER"
  printf '   LOOP enforcement activo. Para desactivar: borrá el ledger (deliberado; si hay git, queda en el diff).\n'
  exit 0
fi

printf '❌ No se pudo escribir el ledger en %s.\n' "$LOOP_STATE_DIR" >&2
exit 1
