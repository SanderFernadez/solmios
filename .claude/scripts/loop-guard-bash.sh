#!/usr/bin/env bash
# loop-guard-bash.sh — PreToolUse hook (matcher: Bash).
# Cierra LOOP-001: detecta mutación de archivos vía shell y aplica el mismo gate que
# guard-write. Patrones detectados: redirección a archivo (> >>), y mutadores explícitos
# (tee, sed -i, cp, mv, touch, dd, patch, install, perl -i, rsync, git apply/checkout--/reset).
#
# Ante la duda PERMITE (plan Riesgo A): un falso positivo que traba `npm test` es inutil,
# así que T2 —permitir comandos legítimos— es TAN bloqueante como T1.
set -u

INPUT="$(cat)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/loop-lib.sh"

loop_is_adopted || { loop_json_allow; exit 0; }
# Bash legítimo es muy común; sin jq no podemos analizar el comando. No travamos bash entero.
loop_have_jq || { loop_json_allow; exit 0; }
if ! loop_verify_tail >/dev/null 2>&1; then
  loop_json_deny "🔴 LOOP: cadena del ledger rota. Reparar: .claude/scripts/loop-doctor.sh"
  exit 0
fi

CMD="$(printf '%s' "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null)"
[ -n "$CMD" ] || { loop_json_allow; exit 0; }

mutates=0
# Redirección a archivo: > o >> no precedidos por dígito/& (excluye 2>, 1>, >&) y no seguidos de &.
if printf '%s' "$CMD" | grep -qE '(^|[^0-9&>])>>?[[:space:]]*[^&]' 2>/dev/null; then
  mutates=1
fi
# Comandos mutadores explícitos.
if printf '%s' "$CMD" | grep -qE '(^|[[:space:];|])(tee|sed[[:space:]].*-i|-i.*sed|cp|mv|rm|touch|dd|patch|install|perl[[:space:]]+-i|rsync)([[:space:]]|$)' 2>/dev/null; then
  mutates=1
fi
# Git que sobreescribe archivos del árbol.
if printf '%s' "$CMD" | grep -qE 'git[[:space:]]+(apply|checkout[[:space:]]+--|checkout[[:space:]]+\.|reset[[:space:]]+--hard|stash[[:space:]]+(drop|clear))' 2>/dev/null; then
  mutates=1
fi
# Intérpretes que escriben/renombran archivos (plan §7 promete python -c open como cubierto).
if printf '%s' "$CMD" | grep -qE '(python3?)[[:space:]]+-c.*(open\([^)]*[wa]|os\.(rename|replace|remove|unlink))|node[[:space:]]+-e.*(writeFileSync|writeFile|appendFile)' 2>/dev/null; then
  mutates=1
fi

[ "$mutates" = "1" ] || { loop_json_allow; exit 0; }

# Mutación detectada. Si es solo redirección (no mutador explícito como cp/mv/rm) y NINGÚN
# destino cae dentro del repo, no es asunto de este gate: escribir a /tmp, /dev/null, /dev/tty
# o cualquier ruta absoluta fuera del proyecto no puede trabar trabajo legítimo (plan Riesgo A).
if ! printf '%s' "$CMD" | grep -qE '(^|[[:space:];|])(cp|mv|rm|touch|tee|dd|patch|install|rsync)([[:space:]]|$)|(python3?|node)[[:space:]]+-(c|e)' 2>/dev/null; then
  touches_repo=0
  while IFS= read -r dst; do
    [ -n "$dst" ] || continue
    case "$dst" in /dev/*|/tmp/*) continue ;; esac
    if loop_is_inside_root "$(loop_abs_path "$dst")"; then touches_repo=1; break; fi
  done < <(printf '%s' "$CMD" | grep -oE '>>?[[:space:]]*[^[:space:];&|]+' | sed -E 's/>>?[[:space:]]*//')
  [ "$touches_repo" = "1" ] || { loop_json_allow; exit 0; }
fi

# Mutación detectada. ¿Toca ruta protegida? (autodefensa — chequeo textual del comando).
hits_protected=0
for marker in $LOOP_PROTECTED_MARKERS; do
  case "$CMD" in
    *"$marker"*) hits_protected=1; break ;;
  esac
done
if [ "$hits_protected" = "1" ]; then
  if loop_maintenance_on; then
    loop_note_maintenance
    loop_append maintenance_write "via=bash" 2>/dev/null || true
    loop_json_allow; exit 0
  fi
  snippet="$(printf '%s' "$CMD" | head -c 120)"
  loop_json_deny "🔴 LOOP: el comando muta una ruta protegida del sistema. Para mantenerlo: LOOP_MAINTENANCE=1 (queda registrado). Comando: $snippet"
  exit 0
fi

# Mutación de app (no claramente protegida): gate de tarea abierta.
task="$(loop_current_task)"
if [ -z "$task" ]; then
  snippet="$(printf '%s' "$CMD" | head -c 120)"
  loop_json_deny "🔴 LOOP GATE: el comando muta archivos sin tarea abierta. Invocá loop-workflow, o abrí tarea: .claude/scripts/loop-open-task.sh <slug> <workflow>. Comando: $snippet"
  exit 0
fi

loop_append app_write "via=bash" "task_id=$task" 2>/dev/null || true
loop_json_allow
