#!/usr/bin/env bash
# loop-doctor.sh — Autodiagnóstico (manual + llamado por SessionStart).
# Cubre el fallo silencioso: un hook roto no puede denunciarse a sí mismo, así que
# el chequeo lo corre OTRO evento (plan §5). Reporta, no repara.
#
# Uso: .claude/scripts/loop-doctor.sh
# Salida: texto humano. Exit 0 si sin errores, 1 si hay algo roto.
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/loop-lib.sh"

errors=0
warn=0
say_ok()   { printf '  ✓ %s\n' "$1"; }
say_warn() { printf '  ⚠ %s\n' "$1"; warn=$((warn + 1)); }
say_fail() { printf '  ✗ %s\n' "$1"; errors=$((errors + 1)); }

printf 'LOOP doctor — %s\n' "$(loop_now 2>/dev/null || echo '?')"

# 1. jq (dependencia dura)
if loop_have_jq; then say_ok 'jq presente'; else say_fail 'jq AUSENTE — los guards no funcionan. Instalalo.'; fi

# 2. sha256 (para la cadena de hash)
if command -v sha256sum >/dev/null 2>&1 || command -v shasum >/dev/null 2>&1; then
  say_ok 'sha256 disponible (cadena verificable)'
else
  say_warn 'sha256 AUSENTE — la cadena degrada a marcador "nosha" (loop-lib fallback)'
fi

# 3. permisos de ejecución de scripts (loop-lib.sh es sourced, no ejecutable: se exime)
for s in "$SCRIPT_DIR"/*.sh; do
  [ -e "$s" ] || continue
  case "$(basename "$s")" in
    loop-lib.sh) continue ;;  # librería que se sourcea, no se ejecuta directo
  esac
  [ -x "$s" ] || say_fail "no ejecutable: $(basename "$s") (chmod +x)"
done
say_ok 'permisos de scripts revisados'

# 4. settings.json cablea hooks
settings="$LOOP_ROOT/.claude/settings.json"
if [ -f "$settings" ]; then say_ok 'settings.json presente'; else say_warn 'settings.json ausente — ningún hook cableado'; fi

# 5. adopción + integridad de cadena
if loop_is_adopted; then
  say_ok "adoptado: $LOOP_LEDGER"
  bad="$(loop_verify_chain 2>/dev/null)"
  rc=$?
  case "$rc" in
    0) say_ok 'cadena de hash íntegra' ;;
    2) say_warn 'cadena no verificada (sin jq)' ;;
    *) say_fail "cadena ROTA en la entrada #$bad — el ledger fue manipulado o corrompido" ;;
  esac
else
  say_warn 'NO adoptado — guards inertes. Activar: .claude/scripts/loop-init.sh'
fi

printf '\nResumen: %d error(es), %d warning(s)\n' "$errors" "$warn"
[ "$errors" -eq 0 ] || exit 1
exit 0
