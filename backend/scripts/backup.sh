#!/usr/bin/env bash
# Nightly Postgres backup for the VPS. Installs as:
#   crontab -e  ->  0 2 * * * /path/to/backend/scripts/backup.sh >> /var/log/sajilo-backup.log 2>&1
# Keeps 14 days locally; sync the directory off-site (rsync/rclone).
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/sajilo}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%F_%H%M)"
mkdir -p "$BACKUP_DIR"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL not set" >&2
  exit 1
fi

OUT="$BACKUP_DIR/sajilo-$STAMP.dump.gz"
pg_dump --no-owner --format=custom "$DATABASE_URL" | gzip > "$OUT"
find "$BACKUP_DIR" -name 'sajilo-*.dump.gz' -mtime +"$KEEP_DAYS" -delete

echo "backup ok: $OUT ($(du -h "$OUT" | cut -f1))"
echo "restore test (recommended monthly): pg_restore --clean -d <fresh-db> $OUT"
