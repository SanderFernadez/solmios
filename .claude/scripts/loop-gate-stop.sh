#!/usr/bin/env bash
# loop-gate-stop.sh — Stop hook (el checkpoint que el agente no puede elegir no alcanzar).
# Cierra LOOP-003: si la tarea llegó a Build (app_write o agent_ran build) pero NUNCA pasó
# por Verify (agent_ran qa), bloquea el fin de turno UNA vez. Al segundo intento deja pasar
# y registra gate_overridden (acción deliberada, no accidente — plan §2 tabla duro/blando).
#
# Plan §5: NUNCA cierra Stop por jq ausente o ledger ausente (no atrapa al usuario).
set -u

INPUT="$(cat)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/loop-lib.sh"

# No adoptado o sin jq: jamás trabar el fin de turno.
loop_is_adopted || { printf '{}\n'; exit 0; }
loop_have_jq     || { printf '{}\n'; exit 0; }

task="$(loop_current_task)"
# Sin tarea abierta: nada que enforcear (un turno de conversación/consulta termina libre).
[ -n "$task" ] || { printf '{}\n'; exit 0; }

stop_hook_active="$(printf '%s' "$INPUT" | jq -r '.stop_hook_active // false' 2>/dev/null)"

st="$(loop_task_state)"
build="$(printf '%s' "$st" | cut -d'|' -f2)"
verified="$(printf '%s' "$st" | cut -d'|' -f3)"

# Si el agente ya está reintentando tras un bloqueo previo: dejar pasar + registrar.
if [ "$stop_hook_active" = "true" ]; then
  if [ "$build" = "1" ] && [ "$verified" = "0" ]; then
    # H4: no duplicar gate_overridden — solo la primera vez por tarea (evita inflar el ledger).
    already="$(jq -Rs --arg t "$task" 'split("\n")|map(select(length>0)|(fromjson? // empty))|any(.event=="gate_overridden" and ((.task_id//"")==$t))' "$LOOP_LEDGER" 2>/dev/null)"
    [ "$already" = "true" ] || loop_append gate_overridden "task_id=$task" "reason=stop-after-build-without-qa" 2>/dev/null || true
  fi
  printf '{}\n'
  exit 0
fi

# Tarea en Build sin qa: bloquear una vez, nombrando qué falta.
if [ "$build" = "1" ] && [ "$verified" = "0" ]; then
  loop_json_block "🔴 LOOP: la tarea $task llegó a Build pero no pasó por Verify (falta agent_ran qa). Corré el agente qa (Agent tool, subagent_type=qa) antes de terminar el turno. Si igual querés terminar ahora, reintentá: se registrará gate_overridden y se dejará pasar."
  exit 0
fi

printf '{}\n'
