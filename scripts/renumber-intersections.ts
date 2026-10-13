/**
 * Renumbers intersections to 1..N, in their existing order, and moves their image blobs to match.
 *
 * Production lost its first intersections, so ids started at 8 — awkward once an id sits in a
 * URL. Ids are rewritten in one locked transaction (`IntersectionImage.intersectionId` follows
 * via ON UPDATE CASCADE) and the sequence is reset to continue from N+1. Storage keys embed the
 * id (`intersections/<id>/<uuid>.webp`), so each blob is then moved under its new id.
 *
 * Dry by default — pass --apply to write. Idempotent: ids already 1..N and keys already under
 * their id are left alone, so a partial run can simply be re-run.
 */
import { posix } from "node:path";
import { prisma } from "@/lib/server/prisma";
import { assertNotProduction, assertTargetsAgree } from "@/lib/server/env-guard";
import { getSupabase, bucket } from "@/lib/server/supabase";

const APPLY = process.argv.includes("--apply");

function expectedKey(storageKey: string, intersectionId: number): string {
  return `intersections/${intersectionId}/${posix.basename(storageKey)}`;
}

async function renumberIds(): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // The hourly ingest waits on this instead of inserting mid-renumber.
    await tx.$executeRaw`LOCK TABLE "Intersection" IN EXCLUSIVE MODE`;
    // Step every row aside first so a new id never collides with an old one.
    await tx.$executeRaw`UPDATE "Intersection" SET "id" = -"id"`;
    // DESC on the negated ids is the original ascending order.
    await tx.$executeRaw`
      UPDATE "Intersection" AS i
      SET "id" = r.n
      FROM (SELECT "id", ROW_NUMBER() OVER (ORDER BY "id" DESC) AS n FROM "Intersection") AS r
      WHERE i."id" = r."id"`;
    await tx.$queryRaw`
      SELECT setval(
        pg_get_serial_sequence('"Intersection"', 'id'),
        COALESCE((SELECT MAX("id") FROM "Intersection"), 0) + 1,
        false
      )`;
  });
}

/** Moves one blob under its new id; tolerates a destination left by an earlier, interrupted run. */
async function moveBlob(from: string, to: string): Promise<void> {
  const storage = getSupabase().storage.from(bucket());
  const { error } = await storage.move(from, to);
  if (!error) return;

  const { data: alreadyThere } = await storage.exists(to);
  if (!alreadyThere) throw error;
}

async function main() {
  const intersections = await prisma.intersection.findMany({
    select: { id: true },
    orderBy: { id: "asc" },
  });
  const newIdOf = new Map(intersections.map((ix, i) => [ix.id, i + 1]));
  const idChanges = intersections.filter((ix) => newIdOf.get(ix.id) !== ix.id);

  const images = await prisma.intersectionImage.findMany({
    select: { intersectionId: true, storageKey: true },
    orderBy: { createdAt: "asc" },
  });
  const keyChanges = images
    .map((img) => ({
      from: img.storageKey,
      to: expectedKey(img.storageKey, newIdOf.get(img.intersectionId)!),
    }))
    .filter(({ from, to }) => from !== to);

  console.log(`[Renumber] ${intersections.length} intersection(s), ${images.length} image(s)`);
  console.log(`[Renumber] ${idChanges.length} id(s) to change`);
  for (const ix of idChanges) console.log(`  #${ix.id} → #${newIdOf.get(ix.id)}`);
  if (idChanges.length > 0) {
    console.log(`[Renumber] next new intersection gets #${intersections.length + 1}`);
  }
  console.log(`[Renumber] ${keyChanges.length} image key(s) to move`);
  for (const { from, to } of keyChanges) console.log(`  ${from} → ${to}`);

  if (idChanges.length === 0 && keyChanges.length === 0) {
    console.log("\n[Renumber] Already tidy — nothing to do.");
    return;
  }

  if (!APPLY) {
    console.log("\n[Renumber] DRY RUN — nothing written. Re-run with --apply.");
    return;
  }

  assertNotProduction("renumber-intersections --apply");
  // Rows come from the database and blobs from the bucket; moving blobs for a row set from the
  // other environment would scramble the real objects.
  assertTargetsAgree("renumber-intersections --apply");

  if (idChanges.length > 0) {
    await renumberIds();
    console.log(`[Renumber] Ids renumbered to #1–#${intersections.length}`);
  }

  // Re-read after the renumber: the rows now carry their new intersectionId.
  const toMove = (
    await prisma.intersectionImage.findMany({
      select: { id: true, intersectionId: true, storageKey: true },
      orderBy: { createdAt: "asc" },
    })
  ).filter((img) => img.storageKey !== expectedKey(img.storageKey, img.intersectionId));

  let done = 0;
  let failed = 0;

  for (const img of toMove) {
    const newKey = expectedKey(img.storageKey, img.intersectionId);
    try {
      await moveBlob(img.storageKey, newKey);
      await prisma.intersectionImage.update({
        where: { id: img.id },
        data: { storageKey: newKey },
      });
      console.log(`[Renumber] ${img.storageKey} → ${newKey}`);
      done++;
    } catch (err) {
      console.error(`[Renumber] FAILED ${img.storageKey}:`, err);
      failed++;
    }
  }

  console.log(`[Renumber] Done — ${done} image(s) moved, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(`\n${e instanceof Error ? e.message : e}\n`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
