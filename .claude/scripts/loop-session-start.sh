#!/usr/bin/env bash
# loop-session-start.sh — SessionStart hook (matcher: startup|resume|clear|compact).
# Continuidad: reinyecta el estado del ledger (tarea, fase, próximo agente) en cada arranque.
# En source=compact es lo que reemplaza la vía muerta de PostCompact (plan §6 D5).
# En source=startup además verifica integridad de cadena (detecta manipulación entre sesiones).
set -u

INPUT="$(cat)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/loop-lib.sh"

source_event="$(printf '%s' "$INPUT" | jq -r '.source // "startup"' 2>/dev/null)"

if ! loop_is_adopted; then
  loop_json_context SessionStart "ℹ️  LOOP está copiado pero no activo en este repo (no hay ledger). Para activar el enforcement: .claude/scripts/loop-init.sh"
  exit 0
fi

if ! loop_have_jq; then
  loop_json_context SessionStart "⚠️ LOOP: jq no está disponible — el enforcement está ciego. Instalá jq."
  exit 0
fi

chain_bad="$(loop_verify_chain 2>/dev/null)"
if [ "$?" -eq 1 ]; then
  loop_json_context SessionStart "🔴 LOOP: la cadena del ledger está rota en la entrada #$chain_bad (posible manipulación). Reparar: .claude/scripts/loop-doctor.sh. Mientras tanto, los guards de escritura deniegan."
  exit 0
fi

task="$(loop_current_task)"
phase="$(loop_phase)"
next="$(loop_next_agent)"
last_ts="$(loop_last_ts 2>/dev/null || echo '?')"

if [ -z "$task" ]; then
  msg="LOOP: sin tarea abierta (fase=$phase). Última actividad: $last_ts. Para empezar: invocá loop-workflow o abrí tarea con .claude/scripts/loop-open-task.sh <slug> <workflow>."
else
  msg="LOOP: tarea=$task · fase=$phase · próximo agente=$next · última actividad=$last_ts."
  [ "$phase" = "Verify" ] && msg="$msg (Build produjo escritura; falta correr qa antes de cerrar el turno)."
fi

[ "$source_event" = "compact" ] && msg="[tras compactación] $msg"
loop_json_context SessionStart "$msg"
