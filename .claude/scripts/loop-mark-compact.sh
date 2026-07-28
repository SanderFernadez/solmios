#!/usr/bin/env bash
# loop-mark-compact.sh — PreCompact + PostCompact hooks.
# PostCompact NO acepta additionalContext (verificado contra el binario — plan §6 D5), así
# que este hook SOLO marca en disco que hubo compactación, para que la reinyección siguiente
# (SessionStart:compact) sea consciente. No inyecta contexto porque no puede.
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/loop-lib.sh"

printf '%s\n' "$(loop_now 2>/dev/null || echo '?')" > "$LOOP_COMPACT_MARKER" 2>/dev/null || true
printf '{}\n'
