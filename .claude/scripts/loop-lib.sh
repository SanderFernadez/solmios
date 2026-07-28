#!/usr/bin/env bash
# loop-lib.sh — base compartida de todos los hooks de LOOP.
#
# NO es un hook: se hace `source` desde los demás scripts. No llama a `exit`.
#
# Responsabilidades (plan §7):
#   - Raíz portable (cero rutas absolutas hardcodeadas).
#   - Estado de adopción del proyecto (plan §4).
#   - Append al ledger con lock + cadena de hash (plan §3, capa 1).
#   - Consulta de tarea/fase derivada SOLO del ledger (nunca de archivos .md, plan §3 capa 2).
#   - Clasificación de rutas: protegida / código de app.
#   - Emisión de JSON de salida para el runtime de hooks.
#
# Todo lo compartido vive acá. Duplicarlo en un script es cómo diverge el enforcement.

# ---------------------------------------------------------------------------
# Raíz del proyecto
# ---------------------------------------------------------------------------
# Preferencia: CLAUDE_PROJECT_DIR si apunta a un proyecto que tiene .claude/.
# Fallback: derivar de BASH_SOURCE (este archivo vive en <root>/.claude/scripts/).
# Nunca hay rutas absolutas literales: este repo se copia a cualquier máquina.
_loop_resolve_root() {
  local candidate script_dir
  candidate="${CLAUDE_PROJECT_DIR:-}"
  if [ -n "$candidate" ] && [ -d "$candidate/.claude" ]; then
    (cd "$candidate" 2>/dev/null && pwd) && return 0
  fi
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)" || return 1
  (cd "$script_dir/../.." 2>/dev/null && pwd)
}

LOOP_ROOT="${LOOP_ROOT:-$(_loop_resolve_root)}"

# ---------------------------------------------------------------------------
# Configuración (todo overrideable por entorno; cero valores de negocio hardcodeados)
# ---------------------------------------------------------------------------
LOOP_SCHEMA="${LOOP_SCHEMA:-1}"
LOOP_STATE_DIR="${LOOP_STATE_DIR:-$LOOP_ROOT/.claude/state}"
LOOP_LEDGER="${LOOP_LEDGER:-$LOOP_STATE_DIR/ledger.jsonl}"
LOOP_LOCK_FILE="${LOOP_LOCK_FILE:-$LOOP_STATE_DIR/.ledger.lock}"
LOOP_COMPACT_MARKER="${LOOP_COMPACT_MARKER:-$LOOP_STATE_DIR/.compact-marker}"
LOOP_LOCK_TIMEOUT="${LOOP_LOCK_TIMEOUT:-2}"        # segundos; jamás colgar una tool call
LOOP_LOCK_STALE_MIN="${LOOP_LOCK_STALE_MIN:-1}"    # minutos para considerar lock huérfano
LOOP_BUILD_AGENTS="${LOOP_BUILD_AGENTS:-backend frontend database}"
LOOP_VERIFY_AGENTS="${LOOP_VERIFY_AGENTS:-qa}"
LOOP_PLAN_AGENT="${LOOP_PLAN_AGENT:-architect}"
LOOP_SHIP_AGENT="${LOOP_SHIP_AGENT:-reviewer}"
LOOP_STALE_TASK_HOURS="${LOOP_STALE_TASK_HOURS:-24}"
LOOP_MAINTENANCE="${LOOP_MAINTENANCE:-0}"
# Flag file alternativo: la var de entorno NO persiste al entorno con el que Claude Code
# invoca los hooks. Para mantenimiento del propio sistema (escribir en rutas protegidas),
# se crea este archivo y se borra al terminar. Lo respetan todos los guards.
LOOP_MAINTENANCE_FLAG="${LOOP_MAINTENANCE_FLAG:-$LOOP_STATE_DIR/.maintenance}"
LOOP_INIT_CMD="${LOOP_INIT_CMD:-.claude/scripts/loop-init.sh}"
LOOP_DOCTOR_CMD="${LOOP_DOCTOR_CMD:-.claude/scripts/loop-doctor.sh}"

# Rutas protegidas: autodefensa del sistema. Relativas a la raíz.
# Un prefijo terminado en "/" protege todo el subárbol.
LOOP_PROTECTED_PATHS="${LOOP_PROTECTED_PATHS:-.claude/settings.json .claude/settings.local.json .claude/scripts/ .claude/state/ledger.jsonl .claude/method/}"
# Substrings que delatan intención de tocar rutas protegidas desde un comando de shell.
LOOP_PROTECTED_MARKERS="${LOOP_PROTECTED_MARKERS:-.claude/settings.json .claude/scripts .claude/method ledger.jsonl}"
# Rutas exentas del gate de "tarea abierta": son metadata del sistema y narrativa (capa 2).
LOOP_META_PATHS="${LOOP_META_PATHS:-.claude/ openspec/ CLAUDE.md}"

# ---------------------------------------------------------------------------
# Utilidades base
# ---------------------------------------------------------------------------
loop_have_jq() { command -v jq >/dev/null 2>&1; }

loop_now() { date -u +%Y-%m-%dT%H:%M:%SZ; }

# sha256 portable: GNU (sha256sum) o BSD/macOS (shasum -a 256).
_loop_sha() {
  if command -v sha256sum >/dev/null 2>&1; then
    printf '%s' "$1" | sha256sum | cut -d' ' -f1
  elif command -v shasum >/dev/null 2>&1; then
    printf '%s' "$1" | shasum -a 256 | cut -d' ' -f1
  else
    # Sin hash disponible: la cadena degrada a marcador constante y loop-doctor lo denuncia.
    printf 'nosha'
  fi
}

# Escape mínimo para armar JSON cuando jq NO está disponible.
_loop_escape() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  s="${s//$'\t'/\\t}"
  s="${s//$'\r'/}"
  printf '%s' "$s"
}

# ---------------------------------------------------------------------------
# Adopción (plan §4): ausencia de ledger = proyecto NO adoptado = guards inertes.
# ---------------------------------------------------------------------------
loop_is_adopted() { [ -f "$LOOP_LEDGER" ]; }

# ---------------------------------------------------------------------------
# Append al ledger: lock + cadena de hash
# ---------------------------------------------------------------------------
_loop_append_locked() {
  local event="$1" extra="$2" lock_note="$3"
  local last prev seq body hash line

  if [ -s "$LOOP_LEDGER" ]; then
    last="$(tail -n 1 "$LOOP_LEDGER" 2>/dev/null)"
    prev="$(printf '%s' "$last" | jq -r '.hash // ""' 2>/dev/null)"
    seq="$(printf '%s' "$last" | jq -r '.seq // 0' 2>/dev/null)"
    case "$seq" in ''|*[!0-9]*) seq=0 ;; esac
    seq=$((seq + 1))
    [ -n "$prev" ] || prev="BROKEN"
  else
    prev="GENESIS"
    seq=1
  fi

  body="$(jq -cn \
    --argjson schema "$LOOP_SCHEMA" \
    --argjson seq "$seq" \
    --arg ts "$(loop_now)" \
    --arg event "$event" \
    --arg prev "$prev" \
    --argjson lock "$lock_note" \
    --argjson extra "$extra" \
    '{schema:$schema, seq:$seq, ts:$ts, event:$event, prev:$prev}
     + (if $lock then {lock_timeout:true} else {} end)
     + $extra' 2>/dev/null)" || return 1
  [ -n "$body" ] || return 1

  hash="$(_loop_sha "$body")"
  line="$(printf '%s' "$body" | jq -c --arg h "$hash" '. + {hash:$h}' 2>/dev/null)" || return 1
  [ -n "$line" ] || return 1

  printf '%s\n' "$line" >> "$LOOP_LEDGER"
}

_loop_mkdir_lock() {
  local dir="${LOOP_LOCK_FILE}.d" tries=0 max=20
  # Lock huérfano de un proceso muerto: se recicla por antigüedad.
  if [ -d "$dir" ] && command -v find >/dev/null 2>&1; then
    if [ -n "$(find "$dir" -maxdepth 0 -mmin "+$LOOP_LOCK_STALE_MIN" 2>/dev/null)" ]; then
      rmdir "$dir" 2>/dev/null || true
    fi
  fi
  while [ "$tries" -lt "$max" ]; do
    if mkdir "$dir" 2>/dev/null; then return 0; fi
    sleep 0.1 2>/dev/null || sleep 1
    tries=$((tries + 1))
  done
  return 1
}

_loop_mkdir_unlock() { rmdir "${LOOP_LOCK_FILE}.d" 2>/dev/null || true; }

# loop_append <event> [clave=valor ...]
# Nunca falla ruidosamente: si no puede escribir, devuelve !=0 y el llamador decide.
loop_append() {
  local event="$1"; shift || true
  local extra='{}' kv k v rc=0

  loop_have_jq || return 1
  [ -d "$LOOP_STATE_DIR" ] || mkdir -p "$LOOP_STATE_DIR" 2>/dev/null || return 1

  for kv in "$@"; do
    k="${kv%%=*}"
    v="${kv#*=}"
    [ -n "$k" ] || continue
    extra="$(printf '%s' "$extra" | jq -c --arg k "$k" --arg v "$v" '.[$k] = $v' 2>/dev/null)" || return 1
  done

  if command -v flock >/dev/null 2>&1; then
    ( flock -w "$LOOP_LOCK_TIMEOUT" 9 || exit 3
      _loop_append_locked "$event" "$extra" false ) 9>"$LOOP_LOCK_FILE"
    rc=$?
  else
    if _loop_mkdir_lock; then
      _loop_append_locked "$event" "$extra" false
      rc=$?
      _loop_mkdir_unlock
    else
      rc=3
    fi
  fi

  # Lock ocupado: jamás colgar la tool call del usuario (plan §5).
  # Se escribe igual, marcado, para que la anomalía quede registrada y no se pierda el evento.
  if [ "$rc" -eq 3 ]; then
    _loop_append_locked "$event" "$extra" true
    rc=$?
  fi

  return "$rc"
}

# ---------------------------------------------------------------------------
# Verificación de cadena
# ---------------------------------------------------------------------------
# Completa: O(n). La usan loop-doctor y SessionStart (una vez por sesión), NO los guards.
loop_verify_chain() {
  local prev="GENESIS" n=0 line body hash
  loop_is_adopted || return 0
  loop_have_jq || return 2
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    n=$((n + 1))
    body="$(printf '%s' "$line" | jq -c 'del(.hash)' 2>/dev/null)" || { printf '%s' "$n"; return 1; }
    hash="$(printf '%s' "$line" | jq -r '.hash // ""' 2>/dev/null)"
    if [ "$(printf '%s' "$line" | jq -r '.prev // ""' 2>/dev/null)" != "$prev" ]; then
      printf '%s' "$n"; return 1
    fi
    if [ "$(_loop_sha "$body")" != "$hash" ]; then
      printf '%s' "$n"; return 1
    fi
    prev="$hash"
  done < "$LOOP_LEDGER"
  return 0
}

# De cola: O(1). La usan los guards en cada tool call (presupuesto de 5s del schema).
# Detecta manipulación perezosa del final del ledger. Límite honesto documentado en ENFORCEMENT.md.
loop_verify_tail() {
  local last prevline body hash prev_expected
  loop_is_adopted || return 0
  loop_have_jq || return 2
  [ -s "$LOOP_LEDGER" ] || return 0

  last="$(tail -n 1 "$LOOP_LEDGER" 2>/dev/null)"
  [ -n "$last" ] || return 0
  body="$(printf '%s' "$last" | jq -c 'del(.hash)' 2>/dev/null)" || return 1
  hash="$(printf '%s' "$last" | jq -r '.hash // ""' 2>/dev/null)"
  [ "$(_loop_sha "$body")" = "$hash" ] || return 1

  if [ "$(wc -l < "$LOOP_LEDGER" 2>/dev/null || printf 0)" -gt 1 ]; then
    prevline="$(tail -n 2 "$LOOP_LEDGER" 2>/dev/null | head -n 1)"
    prev_expected="$(printf '%s' "$prevline" | jq -r '.hash // ""' 2>/dev/null)"
    [ "$(printf '%s' "$last" | jq -r '.prev // ""' 2>/dev/null)" = "$prev_expected" ] || return 1
  fi
  return 0
}

# ---------------------------------------------------------------------------
# Estado derivado del ledger (ÚNICA fuente de verdad para gates — plan §3)
# ---------------------------------------------------------------------------
# Emite: "<task_id>|<build:0|1>|<verified:0|1>|<workflow>"
loop_task_state() {
  local build_json verify_json
  loop_is_adopted || { printf '||0|0|'; return 0; }
  loop_have_jq || { printf '||0|0|'; return 2; }

  build_json="$(printf '%s\n' $LOOP_BUILD_AGENTS | jq -R . | jq -cs .)"
  verify_json="$(printf '%s\n' $LOOP_VERIFY_AGENTS | jq -R . | jq -cs .)"

  jq -Rsr \
    --argjson build "$build_json" \
    --argjson verify "$verify_json" \
    'split("\n") | map(select(length > 0) | (fromjson? // empty))
     | reduce .[] as $e ({task:null, build:false, verified:false, workflow:""};
         if $e.event == "task_opened" then
           {task: ($e.task_id // null), build:false, verified:false, workflow: ($e.workflow // "")}
         elif ($e.event == "task_closed" or $e.event == "task_reconciled")
              and .task != null and $e.task_id == .task then
           {task:null, build:false, verified:false, workflow:""}
         elif .task != null and ($e.task_id // "") == .task then
           (if $e.event == "app_write" then .build = true
            elif $e.event == "agent_ran" and ($build | index($e.agent // "")) then .build = true
            elif $e.event == "agent_ran" and ($verify | index($e.agent // "")) then .verified = true
            else . end)
         else . end)
     | [(.task // ""),
        (if .build then "1" else "0" end),
        (if .verified then "1" else "0" end),
        (.workflow // "")]
     | join("|")' "$LOOP_LEDGER" 2>/dev/null || printf '||0|0|'
}

loop_current_task() { loop_task_state | cut -d'|' -f1; }

# Fase derivada de hechos atestiguados, no de current_plan.md.
loop_phase() {
  local st task build verified
  st="$(loop_task_state)"
  task="$(printf '%s' "$st" | cut -d'|' -f1)"
  build="$(printf '%s' "$st" | cut -d'|' -f2)"
  verified="$(printf '%s' "$st" | cut -d'|' -f3)"
  if [ -z "$task" ]; then printf 'sin-tarea'
  elif [ "$verified" = "1" ]; then printf 'Ship'
  elif [ "$build" = "1" ]; then printf 'Verify'
  else printf 'Build'
  fi
}

# Próximo agente requerido según la fase.
loop_next_agent() {
  case "$(loop_phase)" in
    sin-tarea) printf '%s' "$LOOP_PLAN_AGENT" ;;
    Build)     printf '%s' "$(printf '%s' "$LOOP_BUILD_AGENTS" | cut -d' ' -f1)" ;;
    Verify)    printf '%s' "$(printf '%s' "$LOOP_VERIFY_AGENTS" | cut -d' ' -f1)" ;;
    Ship)      printf '%s' "$LOOP_SHIP_AGENT" ;;
  esac
}

loop_last_ts() {
  loop_is_adopted || return 1
  tail -n 1 "$LOOP_LEDGER" 2>/dev/null | jq -r '.ts // ""' 2>/dev/null
}

loop_maintenance_on() { [ "$LOOP_MAINTENANCE" = "1" ] || [ -f "$LOOP_MAINTENANCE_FLAG" ]; }

# Registra la activación de maintenance en el ledger (idempotente por tarea).
# Cierra el bypass de "crear el flag .maintenance silenciosamente": la acción que habilita
# escribir en rutas protegidas ahora deja traza (propiedad c: ruptura ruidosa). No previene
# el bypass (el agente tiene Bash) — lo hace visible, que es lo alcanzable.
loop_note_maintenance() {
  loop_maintenance_on || return 0
  loop_is_adopted || return 0
  loop_have_jq || return 0
  local task already
  task="$(loop_current_task)"
  [ -n "$task" ] || return 0
  already="$(jq -Rs --arg t "$task" 'split("\n")|map(select(length>0)|(fromjson? // empty))|any(.event=="maintenance_enabled" and ((.task_id//"")==$t))' "$LOOP_LEDGER" 2>/dev/null)"
  [ "$already" = "true" ] && return 0
  loop_append maintenance_enabled "task_id=$task" 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# Clasificación de rutas
# ---------------------------------------------------------------------------
# Normaliza a ruta absoluta sin exigir que el archivo exista.
loop_abs_path() {
  local p="$1"
  [ -n "$p" ] || return 1
  case "$p" in
    /*) : ;;
    *) p="$LOOP_ROOT/$p" ;;
  esac
  if command -v realpath >/dev/null 2>&1; then
    realpath -m "$p" 2>/dev/null || printf '%s' "$p"
  else
    printf '%s' "$p"
  fi
}

loop_is_inside_root() {
  case "$1" in
    "$LOOP_ROOT"/*|"$LOOP_ROOT") return 0 ;;
    *) return 1 ;;
  esac
}

# Ruta protegida = autodefensa del sistema (DENY duro salvo LOOP_MAINTENANCE=1).
loop_is_protected_path() {
  local abs="$1" rel entry
  loop_is_inside_root "$abs" || return 1
  rel="${abs#"$LOOP_ROOT"/}"
  for entry in $LOOP_PROTECTED_PATHS; do
    case "$entry" in
      */) case "$rel" in "$entry"*) return 0 ;; esac ;;
      *)  [ "$rel" = "$entry" ] && return 0 ;;
    esac
  done
  return 1
}

# Código de app = todo lo de adentro del repo que NO es metadata del sistema.
loop_is_app_path() {
  local abs="$1" rel entry
  loop_is_inside_root "$abs" || return 1
  rel="${abs#"$LOOP_ROOT"/}"
  [ "$rel" != "$abs" ] || return 1
  for entry in $LOOP_META_PATHS; do
    case "$entry" in
      */) case "$rel" in "$entry"*) return 1 ;; esac ;;
      *)  [ "$rel" = "$entry" ] && return 1 ;;
    esac
  done
  return 0
}

loop_rel_path() {
  local abs="$1"
  printf '%s' "${abs#"$LOOP_ROOT"/}"
}

# ---------------------------------------------------------------------------
# Salida JSON para el runtime de hooks (SIEMPRE JSON válido, nunca vacío)
# ---------------------------------------------------------------------------
loop_json_allow() { printf '{}\n'; }

loop_json_deny() {
  local reason="$1"
  if loop_have_jq; then
    jq -nc --arg r "$reason" \
      '{hookSpecificOutput:{hookEventName:"PreToolUse", permissionDecision:"deny", permissionDecisionReason:$r}}'
  else
    printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"}}\n' \
      "$(_loop_escape "$reason")"
  fi
}

loop_json_context() {
  local event="$1" ctx="$2"
  if loop_have_jq; then
    jq -nc --arg e "$event" --arg c "$ctx" \
      '{hookSpecificOutput:{hookEventName:$e, additionalContext:$c}}'
  else
    printf '{"hookSpecificOutput":{"hookEventName":"%s","additionalContext":"%s"}}\n' \
      "$(_loop_escape "$event")" "$(_loop_escape "$ctx")"
  fi
}

loop_json_block() {
  local reason="$1"
  if loop_have_jq; then
    jq -nc --arg r "$reason" '{decision:"block", reason:$r}'
  else
    printf '{"decision":"block","reason":"%s"}\n' "$(_loop_escape "$reason")"
  fi
}
