#!/usr/bin/env bash
# loop-record-agent.sh — SubagentStop hook (matcher: todos los agentes).
# La pieza que habilita el gate de Verify/Ship (LOOP-003): registra agent_ran con el
# agent_type que provee el RUNTIME — dato no falsificable por el agente. Nunca bloquea.
set -u

INPUT="$(cat)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/loop-lib.sh"

loop_is_adopted || { printf '{}\n'; exit 0; }
loop_have_jq     || { printf '{}\n'; exit 0; }

agent_type="$(printf '%s' "$INPUT" | jq -r '.agent_type // ""' 2>/dev/null)"
[ -n "$agent_type" ] || { printf '{}\n'; exit 0; }

agent_id="$(printf '%s' "$INPUT" | jq -r '.agent_id // ""' 2>/dev/null)"
task="$(loop_current_task)"

# Solo registra si hay tarea activa (un agente suelto sin tarea no muta el estado).
[ -n "$task" ] || { printf '{}\n'; exit 0; }

loop_append agent_ran "agent=$agent_type" "agent_id=$agent_id" "task_id=$task" 2>/dev/null || true
printf '{}\n'
