#!/usr/bin/env bash
# ops/backup-db.sh — DEP-06: backup diario de la BD PostgreSQL de producción.
#
# Nada hardcodeado: la conexión sale de DATABASE_URL (o de las PG* del entorno), y el
# directorio/retención se configuran por env. Pensado para correr por cron.
#
# Uso:
#   DATABASE_URL=postgres://user:pass@host:5432/solmios \
#   BACKUP_DIR=/www/backups/solmios RETENTION_DAYS=14 ./backup-db.sh
#
# Cron sugerido (diario 03:00):
#   0 3 * * * DATABASE_URL="postgres://..." BACKUP_DIR=/www/backups/solmios \
#             /www/wwwroot/hotel.zx89.site/solmios/ops/backup-db.sh >> /var/log/solmios-backup.log 2>&1
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/www/backups/solmios}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TS="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/solmios-$TS.sql.gz"

mkdir -p "$BACKUP_DIR"

# pg_dump acepta la URI directa. Si no hay DATABASE_URL, cae a las PG* del entorno.
if [ -n "${DATABASE_URL:-}" ]; then
  pg_dump "$DATABASE_URL" | gzip > "$OUT"
else
  PGDATABASE="${PGDATABASE:-solmios}" pg_dump | gzip > "$OUT"
fi

# Un dump vacío/roto no sirve como backup: fallar fuerte para que la alerta lo agarre.
if [ ! -s "$OUT" ]; then
  echo "$(date -Iseconds) ERROR: backup vacío, se descarta ($OUT)" >&2
  rm -f "$OUT"
  exit 1
fi

echo "$(date -Iseconds) backup OK: $OUT ($(du -h "$OUT" | cut -f1))"

# Retención: borrar backups más viejos que RETENTION_DAYS.
find "$BACKUP_DIR" -name 'solmios-*.sql.gz' -type f -mtime "+$RETENTION_DAYS" -print -delete \
  | sed "s/^/$(date -Iseconds) retenido<->eliminado: /" || true

echo "$(date -Iseconds) retención aplicada (>${RETENTION_DAYS}d). Backups actuales: $(find "$BACKUP_DIR" -name 'solmios-*.sql.gz' | wc -l)"
