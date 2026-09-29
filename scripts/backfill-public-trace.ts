/**
 * One-time copy of the trace (Location, WeatherSnapshot, TracePoint, Intersection) from `main`'s
 * production database into this database. Deliberately excludes `IntersectionImage` (doesn't
 * exist in this schema; photos are private) and `Intersection.text` (hand-written commentary is
 * private) — every copied intersection lands with `text: null`, backfilled separately by
 * `backfill-public-haikus.ts`.
 *
 * This is the one sanctioned exception to "ALLOW_PROD is only ever set in CI"
 * (see lib/server/env-guard.ts): this database genuinely is production, but it's unreachable from
 * GitHub Actions (self-hosted, Docker-network-only), so this runs by hand instead. See
 * docs/public-fork.md for the full runbook.
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { createInterface } from "node:readline/promises";
import { prisma as destPrisma } from "@/lib/server/prisma";
import { assertNotProduction } from "@/lib/server/env-guard";

const CONFIRMATION = "copy main into public";
const BATCH_SIZE = 500;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required — the source database to copy from.`);
  return value;
}

const sourcePrisma = new PrismaClient({
  datasources: { db: { url: requireEnv("SOURCE_DATABASE_URL") } },
});

async function copyTable<T>(
  name: string,
  fetch: () => Promise<T[]>,
  write: (chunk: T[]) => Promise<{ count: number }>
): Promise<void> {
  const rows = await fetch();
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const { count } = await write(chunk);
    console.log(
      `[BackfillPublicTrace] ${name}: ${count}/${chunk.length} inserted (chunk ${
        Math.floor(i / BATCH_SIZE) + 1
      }/${Math.ceil(rows.length / BATCH_SIZE)})`
    );
  }
  // Explicit ids bypass the SERIAL sequence, so the next organically-inserted row (from the live
  // hourly cron) would otherwise collide on nextval(). Reset it to the real max.
  await destPrisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"${name}"','id'), COALESCE((SELECT MAX(id) FROM "${name}"),1), (SELECT MAX(id) FROM "${name}") IS NOT NULL)`
  );
  console.log(`[BackfillPublicTrace] ${name}: done, ${rows.length} row(s), sequence reset`);
}

async function main() {
  assertNotProduction("backfill-public-trace");

  const [locations, snapshots, tracePoints, intersections] = await Promise.all([
    sourcePrisma.location.count(),
    sourcePrisma.weatherSnapshot.count(),
    sourcePrisma.tracePoint.count(),
    sourcePrisma.intersection.count(),
  ]);
  console.log(
    `[BackfillPublicTrace] source (main): Location ${locations}, WeatherSnapshot ${snapshots}, ` +
      `TracePoint ${tracePoints}, Intersection ${intersections}`
  );
  console.log(
    `[BackfillPublicTrace] IntersectionImage and Intersection.text are excluded from the copy.`
  );

  if (!process.stdin.isTTY) {
    throw new Error("Refusing to run without an interactive terminal to confirm in.");
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`\nType "${CONFIRMATION}" to proceed: `);
  rl.close();
  if (answer.trim() !== CONFIRMATION) {
    console.log("Aborted — nothing was copied.");
    return;
  }

  await copyTable(
    "Location",
    () => sourcePrisma.location.findMany({ orderBy: { id: "asc" } }),
    (rows) => destPrisma.location.createMany({ data: rows, skipDuplicates: true })
  );

  await copyTable(
    "WeatherSnapshot",
    () => sourcePrisma.weatherSnapshot.findMany({ orderBy: { id: "asc" } }),
    (rows) =>
      destPrisma.weatherSnapshot.createMany({
        data: rows.map((row) => ({ ...row, rawJson: row.rawJson as Prisma.InputJsonValue })),
        skipDuplicates: true,
      })
  );

  await copyTable(
    "TracePoint",
    () => sourcePrisma.tracePoint.findMany({ orderBy: { id: "asc" } }),
    (rows) => destPrisma.tracePoint.createMany({ data: rows, skipDuplicates: true })
  );

  await copyTable(
    "Intersection",
    () =>
      sourcePrisma.intersection.findMany({
        orderBy: { id: "asc" },
        select: {
          id: true,
          tracePointIdA: true,
          tracePointIdB: true,
          x: true,
          y: true,
          detectedAt: true,
          // text deliberately not selected — private, and this makes reading it structurally
          // impossible rather than just unwritten.
        },
      }),
    (rows) => destPrisma.intersection.createMany({ data: rows, skipDuplicates: true })
  );

  console.log("[BackfillPublicTrace] Done.");
}

main()
  .catch((err) => {
    console.error(`\n${err instanceof Error ? err.message : err}\n`);
    process.exit(1);
  })
  .finally(() => Promise.all([sourcePrisma.$disconnect(), destPrisma.$disconnect()]));
