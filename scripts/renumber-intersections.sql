-- Renumbers intersections to 1..N, in their existing order.
--
-- The trace was copied from `main`'s production database, whose first intersections were lost,
-- so ids started at 8 — awkward once an id sits in a URL. Nothing references `Intersection.id`
-- on this branch (no `IntersectionImage`), so plain SQL is enough; `main` needs a script because
-- it also moves image blobs. Safe to re-run: ids already 1..N stay as they are.
--
-- This database is unreachable from GitHub Actions, so it runs by hand, piped into psql in the
-- database container:
--
--   ssh <server> 'docker compose -f /home/david/projects/infra-repo/docker-compose.yml \
--     exec -T weather-public-db psql -U <user> -d <db> -v ON_ERROR_STOP=1' \
--     < scripts/renumber-intersections.sql
--
-- To preview first:
--   SELECT "id", ROW_NUMBER() OVER (ORDER BY "id") AS new_id FROM "Intersection" ORDER BY "id";

BEGIN;

-- The hourly ingest waits on this instead of inserting mid-renumber.
LOCK TABLE "Intersection" IN EXCLUSIVE MODE;

-- Step every row aside first so a new id never collides with an old one.
UPDATE "Intersection" SET "id" = -"id";

-- DESC on the negated ids is the original ascending order.
UPDATE "Intersection" AS i
SET "id" = r.n
FROM (SELECT "id", ROW_NUMBER() OVER (ORDER BY "id" DESC) AS n FROM "Intersection") AS r
WHERE i."id" = r."id";

SELECT setval(
  pg_get_serial_sequence('"Intersection"', 'id'),
  COALESCE((SELECT MAX("id") FROM "Intersection"), 0) + 1,
  false
);

COMMIT;
