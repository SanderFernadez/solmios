# ops/ — Backups y monitoreo (DEP-05 / DEP-06)

Scripts de operación para producción (`hotel.zx89.site`). Nada de credenciales acá: todo sale
de variables de entorno.

## DEP-06 — Backups automáticos de la BD

`backup-db.sh` hace `pg_dump | gzip` con timestamp y aplica retención.

| Variable | Default | Qué es |
|----------|---------|--------|
| `DATABASE_URL` | — (o PG\* del entorno) | Conexión Postgres. `pg_dump` la toma directa. |
| `BACKUP_DIR` | `/www/backups/solmios` | Dónde se guardan los `.sql.gz` |
| `RETENTION_DAYS` | `14` | Borra backups más viejos que N días |

### Instalar el cron (diario 03:00)
```bash
chmod +x ops/backup-db.sh
mkdir -p /www/backups/solmios
# Cargar DATABASE_URL desde el .env del backend y agendar:
( crontab -l 2>/dev/null; echo '0 3 * * * cd /www/wwwroot/hotel.zx89.site/solmios/backend && set -a && . ./.env && set +a && /www/wwwroot/hotel.zx89.site/solmios/ops/backup-db.sh >> /var/log/solmios-backup.log 2>&1' ) | crontab -
```

### Restaurar un backup
```bash
# Listar
ls -lh /www/backups/solmios/
# Restaurar (¡sobrescribe la BD! hacer con el backend detenido)
systemctl stop solmios-backend
gunzip -c /www/backups/solmios/solmios-YYYYMMDD-HHMMSS.sql.gz | psql "$DATABASE_URL"
systemctl start solmios-backend
```

## DEP-05 — Monitoreo (health-check + alertas)

Dos piezas:
1. **Endpoint** `GET /api/health` (backend, sin auth) → `200 {status:ok, checks:{db:up}, uptimeSeconds}` o `503` si la BD no responde.
2. `healthcheck.sh` → pega al endpoint y alerta si no da 200 (al syslog siempre; a un webhook opcional).

| Variable | Default | Qué es |
|----------|---------|--------|
| `HEALTH_URL` | `http://127.0.0.1:3000/api/health` | Endpoint a chequear |
| `ALERT_WEBHOOK` | — (opcional) | Webhook Slack/Discord/Telegram para la alerta |
| `HEALTH_TIMEOUT` | `10` | Timeout del curl (s) |

### Instalar el cron (cada 5 min)
```bash
chmod +x ops/healthcheck.sh
( crontab -l 2>/dev/null; echo '*/5 * * * * HEALTH_URL=http://127.0.0.1:3000/api/health ALERT_WEBHOOK="" /www/wwwroot/hotel.zx89.site/solmios/ops/healthcheck.sh >> /var/log/solmios-health.log 2>&1' ) | crontab -
```
> Para alertas externas, poné el webhook en `ALERT_WEBHOOK`. Sin webhook, la caída queda igual en `journalctl -t solmios-health` y en `/var/log/solmios-health.log`.

## Verificación rápida
```bash
curl -s http://127.0.0.1:3000/api/health | jq        # debe dar status:ok
crontab -l                                            # los 2 jobs agendados
tail -f /var/log/solmios-backup.log                   # tras el primer run
```
