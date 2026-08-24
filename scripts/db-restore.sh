#!/usr/bin/env bash
#
# Restores a production dump into the local development database.
#
# Usage: npm run db:restore -- path/to/backup.dump
#
# The dump comes from the "Daily DB Backup" workflow (pg_dump -Fc against DIRECT_URL); fetch one
# with `gh run download --name db-backup-<run-id>`. Only the `public` schema is restored — that is
# where every application table lives. Supabase's own schemas (auth, storage, ...) are skipped:
# they belong to the hosted platform, not to this app, and nothing local reads them.
#
# Ownership and grants are dropped on the way in (--no-owner --no-privileges) because the roles
# from the hosted cluster do not exist here. That is expected across clusters, not a defect in the
# backup. --exit-on-error is kept so anything else fails loudly rather than leaving a half-restored
# database that looks fine.
set -euo pipefail

DUMP="${1:-}"

if [[ -z "$DUMP" ]]; then
  echo "usage: npm run db:restore -- <path-to-dump>" >&2
  exit 1
fi

if [[ ! -f "$DUMP" ]]; then
  echo "no such file: $DUMP" >&2
  exit 1
fi

if ! docker compose ps --status running --services | grep -qx db; then
  echo "the local database is not running — start it with: npm run db:up" >&2
  exit 1
fi

PSQL=(docker compose exec -T db psql -U weather -d weather -v ON_ERROR_STOP=1)

echo "==> Dropping and recreating schema public"
"${PSQL[@]}" -c 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;' >/dev/null

echo "==> Restoring $DUMP"
docker compose exec -T db pg_restore \
  --username weather \
  --dbname weather \
  --schema public \
  --no-owner \
  --no-privileges \
  --exit-on-error \
  < "$DUMP"

echo "==> Row counts"
"${PSQL[@]}" -c '
  SELECT relname AS table, n_live_tup AS rows
  FROM pg_stat_user_tables
  ORDER BY n_live_tup DESC;'

echo
echo "Restored. If the dump predates the newest migration, catch up with:"
echo "  npx prisma migrate deploy"
