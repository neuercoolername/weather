/**
 * Generates a haiku for every Intersection that doesn't have one yet (text IS NULL) — the
 * counterpart to backfill-public-trace.ts, which deliberately copies intersections with no text.
 * Safely re-runnable: only touches null rows, so a failed call can just be retried by running
 * this again.
 */
import { prisma } from "@/lib/server/prisma";
import { assertNotProduction } from "@/lib/server/env-guard";
import { generateHaiku } from "@/lib/server/haiku";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseLimit(argv: string[]): number | undefined {
  const flag = argv.indexOf("--limit");
  if (flag === -1) return undefined;
  const value = Number(argv[flag + 1]);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`--limit must be a positive integer, got "${argv[flag + 1]}"`);
  }
  return value;
}

async function main() {
  assertNotProduction("backfill-public-haikus");

  const limit = parseLimit(process.argv.slice(2));

  const pending = await prisma.intersection.findMany({
    where: { text: null },
    orderBy: { id: "asc" },
    take: limit,
    select: {
      id: true,
      tracePointA: { select: { snapshot: { select: { rawJson: true } } } },
      tracePointB: { select: { snapshot: { select: { rawJson: true } } } },
    },
  });

  console.log(
    `[BackfillPublicHaikus] ${pending.length} intersection(s) without a haiku` +
      (limit ? ` (--limit ${limit})` : "")
  );

  const failed: number[] = [];

  for (const ix of pending) {
    try {
      const text = await generateHaiku(
        ix.tracePointA.snapshot.rawJson as object,
        ix.tracePointB.snapshot.rawJson as object
      );
      await prisma.intersection.update({ where: { id: ix.id }, data: { text } });
      console.log(`[BackfillPublicHaikus] #${ix.id} written`);
    } catch (err) {
      failed.push(ix.id);
      console.error(
        `[BackfillPublicHaikus] #${ix.id} failed: ${err instanceof Error ? err.message : err}`
      );
    }
    await sleep(300); // sequential, not concurrent — stay clear of Anthropic rate limits
  }

  console.log(
    `[BackfillPublicHaikus] Done — ${pending.length - failed.length} written, ${
      failed.length
    } failed` +
      (failed.length ? `: [${failed.join(", ")}] — re-run to retry, only NULL rows are touched.` : ".")
  );
}

main()
  .catch((err) => {
    console.error(`\n${err instanceof Error ? err.message : err}\n`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
