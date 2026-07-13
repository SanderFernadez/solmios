#!/usr/bin/env bash
# ops/healthcheck.sh — DEP-05: chequea el endpoint de salud y alerta si está caído.
#
# Nada hardcodeado: la URL y el webhook de alerta salen de env.
# Uso (cron cada 5 min):
#   */5 * * * * HEALTH_URL=http://127.0.0.1:3000/api/health \
#               ALERT_WEBHOOK="https://hooks.slack.com/..." \
#               /www/wwwroot/hotel.zx89.site/solmios/ops/healthcheck.sh >> /var/log/solmios-health.log 2>&1
set -uo pipefail

URL="${HEALTH_URL:-http://127.0.0.1:3000/api/health}"
ALERT_WEBHOOK="${ALERT_WEBHOOK:-}"   # opcional: Slack/Discord/Telegram webhook
TIMEOUT="${HEALTH_TIMEOUT:-10}"

code="$(curl -s -o /dev/null -w '%{http_code}' --max-time "$TIMEOUT" "$URL" || echo 000)"

if [ "$code" = "200" ]; then
  echo "$(date -Iseconds) health OK ($code)"
  exit 0
fi

MSG="[SOLMIOS] health-check FALLÓ: $URL -> HTTP $code ($(date -Iseconds))"
echo "$MSG" >&2
# Al syslog del sistema (journald lo levanta) aunque no haya webhook.
logger -t solmios-health "$MSG" 2>/dev/null || true
# Alerta externa opcional.
if [ -n "$ALERT_WEBHOOK" ]; then
  curl -s -X POST "$ALERT_WEBHOOK" -H 'Content-Type: application/json' \
    -d "{\"text\":\"$MSG\"}" --max-time "$TIMEOUT" >/dev/null 2>&1 || true
fi
exit 1
