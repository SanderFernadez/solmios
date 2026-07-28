#!/usr/bin/env bash
# loop-close-task.sh — Cierra la tarea activa en el ledger (manual, al firmar Ship).
# Repone el estado a sin-tarea → cierra LOOP-004 (nadie repone → gate abierto para
# siempre). Invocado por el skill loop-workflow cuando reviewer firma.
#
# Uso: loop-close-task.sh [task_id]   (sin arg: cierra la tarea actualmente activa)
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/loop-lib.sh"

if ! loop_have_jq; then printf '❌ falta jq.\n' >&2; exit 1; fi
if ! loop_is_adopted; then printf '❌ Proyecto no adoptado.\n' >&2; exit 1; fi

task_id="${1:-$(loop_current_task)}"
if [ -z "$task_id" ]; then
  printf 'ℹ️  No hay tarea abierta que cerrar.\n'
  exit 0
fi

# H3: validar que el id es la tarea activa. Si no, el jq reduce no la cerraría y el
# mensaje "Tarea cerrada" sería mentiroso.
current="$(loop_current_task)"
if [ "$task_id" != "$current" ]; then
  printf '❌ "%s" no es la tarea activa (activa: %s). Nada se cerró.\n' "$task_id" "${current:-(ninguna)}" >&2
  exit 1
fi

if loop_append task_closed "task_id=$task_id"; then
  printf '✅ Tarea cerrada: %s\n' "$task_id"
  printf '   Estado repuesto a sin-tarea — el gate vuelve a cerrarse.\n'
  exit 0
fi
printf '❌ No se pudo cerrar la tarea.\n' >&2
exit 1
