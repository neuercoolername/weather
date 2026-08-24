/**
 * Wipes the computed trace so it can be rebuilt from scratch by `backfill:trace`.
 *
 * Local-only, permanently. `Intersection` cascades to `IntersectionImage`, so this also destroys
 * every hand-written intersection text and every image row — the only data on this project that
 * cannot be recomputed from `WeatherSnapshot`. There is no production use for that, so the guard
 * here has no override.
 */
import { createInterface } from "node:readline/promises";
import { prisma } from "@/lib/server/prisma";
import { assertNotProduction } from "@/lib/server/env-guard";

const CONFIRMATION = "delete everything";

async function main() {
  assertNotProduction("reset-trace", { allowOverride: false });

  const [intersections, withText, images, tracePoints] = await Promise.all([
    prisma.intersection.count(),
    prisma.intersection.count({ where: { text: { not: null } } }),
    prisma.intersectionImage.count(),
    prisma.tracePoint.count(),
  ]);

  console.log("This deletes, from the local database:");
  console.log(
    `  Intersection       ${intersections} row(s) — ${withText} carrying hand-written text`
  );
  console.log(
    `  IntersectionImage  ${images} row(s) — cascaded from Intersection`
  );
  console.log(`  TracePoint         ${tracePoints} row(s)`);

  if (images > 0) {
    console.log(
      `\nThe ${images} image blob(s) stay in the storage bucket; only the rows pointing at them go.`
    );
  }

  if (intersections === 0 && tracePoints === 0) {
    console.log("\nNothing to delete.");
    return;
  }

  if (!process.stdin.isTTY) {
    throw new Error(
      "Refusing to run without an interactive terminal to confirm in."
    );
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`\nType "${CONFIRMATION}" to proceed: `);
  rl.close();

  if (answer.trim() !== CONFIRMATION) {
    console.log("Aborted — nothing was deleted.");
    return;
  }

  const deletedIntersections = await prisma.intersection.deleteMany({});
  const deletedTracePoints = await prisma.tracePoint.deleteMany({});

  console.log(
    `Deleted ${deletedIntersections.count} intersection(s) and ${deletedTracePoints.count} trace point(s).`
  );
}

main()
  .catch((err) => {
    console.error(`\n${err instanceof Error ? err.message : err}\n`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
