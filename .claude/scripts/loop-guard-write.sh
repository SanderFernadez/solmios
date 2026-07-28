#!/usr/bin/env bash
# loop-guard-write.sh — PreToolUse hook (matcher: Write|Edit|MultiEdit|NotebookEdit).
# Gate de escritura contra el LEDGER (Capa 1), no contra .md (Capa 2). Cierra LOOP-002/007.
# Reemplaza a loop-enforce-gate.sh.
#
# Decisiones (plan §2, tabla duro/blando — todas sobre HECHOS decidibles):
#   - No adoptado            → INERTE (allow).
#   - Cadena de ledger rota  → DENY + comando de reparación (corrupción = manipulación).
#   - Ruta protegida         → DENY duro salvo LOOP_MAINTENANCE=1 (autodefensa del sistema).
#   - Metadata (.claude/, openspec/, CLAUDE.md) → allow.
#   - Código de app SIN tarea abierta → DENY duro (el gate central; salida: abrir plan).
#   - Código de app CON tarea abierta  → allow + registra app_write en el ledger.
set -u

INPUT="$(cat)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/loop-lib.sh"

loop_is_adopted || { loop_json_allow; exit 0; }

loop_have_jq || { loop_json_deny "🔴 LOOP: jq es requerido para el enforcement (install jq). Escritura bloqueada hasta entonces."; exit 0; }

if ! loop_verify_tail >/dev/null 2>&1; then
  loop_json_deny "🔴 LOOP: la cadena del ledger está rota (posible manipulación). Reparar: .claude/scripts/loop-doctor.sh"
  exit 0
fi

FILE_PATH="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // .tool_input.notebook_path // .tool_input.new_path // ""' 2>/dev/null)"
[ -n "$FILE_PATH" ] || { loop_json_allow; exit 0; }

ABS="$(loop_abs_path "$FILE_PATH")"
loop_is_inside_root "$ABS" || { loop_json_allow; exit 0; }

# Autodefensa: rutas protegidas.
if loop_is_protected_path "$ABS"; then
  if loop_maintenance_on; then
    loop_note_maintenance
    loop_append maintenance_write "path=$(loop_rel_path "$ABS")" "tool=write" 2>/dev/null || true
    loop_json_allow; exit 0
  fi
  loop_json_deny "🔴 LOOP: $(loop_rel_path "$ABS") es ruta protegida (autodefensa del sistema). Para mantenerlo: LOOP_MAINTENANCE=1 (queda registrado)."
  exit 0
fi

# Metadata del sistema: exenta (ahí vive el plan, las specs, las reglas).
if ! loop_is_app_path "$ABS"; then
  loop_json_allow; exit 0
fi

# Código de app: requiere tarea abierta.
task="$(loop_current_task)"
if [ -z "$task" ]; then
  loop_json_deny "🔴 LOOP GATE: no hay tarea abierta. Antes de escribir en $(loop_rel_path "$ABS"): invocá loop-workflow, o abrí tarea con .claude/scripts/loop-open-task.sh <slug> <workflow>"
  exit 0
fi

loop_append app_write "path=$(loop_rel_path "$ABS")" "task_id=$task" 2>/dev/null || true
loop_json_allow
