#!/usr/bin/env bash
# loop-inject-state.sh — UserPromptSubmit hook (todos los prompts).
# Reemplaza a loop-enforce-prompt.sh. Cierra LOOP-005: inyecta el estado del ledger
# INCONDICIONALMENTE (sin regex de keywords — el lenguaje natural no se cubre con verbos).
# El enforcement real vive en PreToolUse + Stop; esto es orientación, no gate.
set -u

INPUT="$(cat)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/loop-lib.sh"

if ! loop_is_adopted; then
  loop_json_context UserPromptSubmit "ℹ️  LOOP copiado pero no activo. Activar: .claude/scripts/loop-init.sh"
  exit 0
fi

loop_have_jq || { printf '{}\n'; exit 0; }

task="$(loop_current_task)"
phase="$(loop_phase)"
next="$(loop_next_agent)"

if [ -z "$task" ]; then
  ctx="LOOP (fase $phase): sin tarea abierta. Si el pedido es de código, invocá loop-workflow o abrí tarea con .claude/scripts/loop-open-task.sh <slug> <workflow> antes de escribir."
else
  ctx="LOOP: tarea=$task · fase=$phase · próximo=$next."
  [ "$phase" = "Verify" ] && ctx="$ctx Falta correr qa antes de cerrar el turno."
fi

loop_json_context UserPromptSubmit "$ctx"
