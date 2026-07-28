#!/usr/bin/env bash
# loop-open-task.sh — Abre una tarea en el ledger (manual, invocado por loop-workflow).
#
# Resuelve el gap del plan §7: define cómo LEER la tarea del ledger pero no cómo
# ESCRIBIR su apertura. Sin esto, el gate de escritura deniega toda app (siempre
# sin-tarea). El skill loop-workflow invoca este script al clasificar la tarea —
# el agente no escribe el ledger directo (Capa 1: solo scripts del sistema).
#
# Uso: loop-open-task.sh <task_id> [workflow] [build_agent build_agent...]
# Ej:  loop-open-task.sh auth-feature create-feature backend frontend
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/loop-lib.sh"

if ! loop_have_jq; then printf '❌ falta jq.\n' >&2; exit 1; fi

task_id="${1:-}"
workflow="${2:-}"
build_agents=""
if [ "$#" -ge 2 ]; then shift 2; build_agents="$*"; fi

if [ -z "$task_id" ]; then
  printf 'Uso: loop-open-task.sh <task_id> [workflow] [build_agent...]\n' >&2
  exit 2
fi

if ! loop_is_adopted; then
  printf '❌ Proyecto no adoptado. Primero: .claude/scripts/loop-init.sh\n' >&2
  exit 1
fi

current="$(loop_current_task)"
if [ -n "$current" ]; then
  printf '❌ Ya hay una tarea abierta: %s\n' "$current" >&2
  printf '   Cerrala antes: .claude/scripts/loop-close-task.sh\n' >&2
  printf '   (LOOP es serial por diseño — plan §6 D1.)\n' >&2
  exit 1
fi

args=(task_id="$task_id")
[ -n "$workflow" ]     && args+=(workflow="$workflow")
[ -n "$build_agents" ] && args+=(build_agents="$build_agents")
if loop_append task_opened "${args[@]}"; then
  printf '✅ Tarea abierta: %s\n' "$task_id"
  [ -n "$workflow" ]     && printf '   workflow:     %s\n' "$workflow"
  [ -n "$build_agents" ] && printf '   build_agents: %s\n' "$build_agents"
  exit 0
fi
printf '❌ No se pudo abrir la tarea en el ledger.\n' >&2
exit 1
