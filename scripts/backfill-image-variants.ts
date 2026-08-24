/**
 * Re-processes images stored before the upload resize pipeline existed.
 *
 * Downloads each original, runs it through the same `processUpload` used at upload time,
 * writes it back under a new .webp key, records the intrinsic size, and removes the old
 * object. Idempotent: rows already stored as .webp with a recorded width are skipped, so
 * a partial run can simply be re-run.
 *
 * Dry by default — pass --apply to write. The original object is kept unless
 * --delete-originals is also passed: the re-encode is lossy and downscaled, so deleting
 * the source makes a 2000px q80 WebP the only copy of that photo that exists.
 */
import { PrismaClient } from "@prisma/client";
import { processUpload } from "../lib/server/images";
import { assertTargetsAgree } from "../lib/server/env-guard";
import { getSupabase, bucket } from "../lib/server/supabase";

const prisma = new PrismaClient();

const APPLY = process.argv.includes("--apply");
const DELETE_ORIGINALS = process.argv.includes("--delete-originals");

function contentTypeFor(storageKey: string): string {
  const ext = storageKey.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "heic" || ext === "heif") return "image/heic";
  return "image/jpeg";
}

async function main() {
  const all = await prisma.intersectionImage.findMany({
    select: { id: true, intersectionId: true, storageKey: true, width: true },
    orderBy: { createdAt: "asc" },
  });

  const pending = all.filter(
    (img) => !(img.storageKey.endsWith(".webp") && img.width !== null)
  );

  console.log(`[Backfill] ${all.length} image(s) total`);
  console.log(`[Backfill] ${all.length - pending.length} already processed`);
  console.log(`[Backfill] ${pending.length} to process`);

  if (pending.length === 0) return;

  if (!APPLY) {
    console.log("\n[Backfill] DRY RUN — nothing written. Re-run with --apply.");
    for (const img of pending) console.log(`  would process ${img.storageKey}`);
    console.log(
      DELETE_ORIGINALS
        ? `\n[Backfill] --delete-originals is set: the ${pending.length} original file(s) ` +
            "above would be PERMANENTLY DELETED after re-encoding, leaving the downscaled " +
            "WebP as the only copy."
        : "\n[Backfill] Originals will be kept (pass --delete-originals to remove them)."
    );
    return;
  }

  // Rows come from the database and blobs from the bucket; if those point at different
  // environments, --delete-originals would remove real objects behind a local row set.
  assertTargetsAgree("backfill-image-variants --apply");

  let done = 0;
  let failed = 0;

  for (const img of pending) {
    try {
      const { data, error } = await getSupabase().storage
        .from(bucket())
        .download(img.storageKey);

      if (error || !data) throw error ?? new Error("empty download");

      const original = Buffer.from(await data.arrayBuffer());
      const processed = await processUpload(
        original,
        contentTypeFor(img.storageKey)
      );

      const newKey = `intersections/${img.intersectionId}/${crypto.randomUUID()}.webp`;

      const { error: uploadError } = await getSupabase().storage
        .from(bucket())
        .upload(newKey, processed.data, { contentType: "image/webp" });

      if (uploadError) throw uploadError;

      // Point the row at the new object before deleting the old one: if this run dies
      // here, the worst case is an orphaned blob, never a row with no image behind it.
      await prisma.intersectionImage.update({
        where: { id: img.id },
        data: {
          storageKey: newKey,
          width: processed.width,
          height: processed.height,
          bytes: processed.bytes,
        },
      });

      if (DELETE_ORIGINALS) {
        await getSupabase().storage.from(bucket()).remove([img.storageKey]);
      }

      const saved = (1 - processed.bytes / original.length) * 100;
      console.log(
        `[Backfill] ${img.storageKey} → ${processed.width}x${processed.height}, ` +
          `${(original.length / 1024).toFixed(0)}KB → ${(processed.bytes / 1024).toFixed(0)}KB ` +
          `(-${saved.toFixed(0)}%)`
      );
      done++;
    } catch (err) {
      console.error(`[Backfill] FAILED ${img.storageKey}:`, err);
      failed++;
    }
  }

  console.log(`[Backfill] Done — ${done} processed, ${failed} failed`);
}

main()
  .catch((e) => {
    console.error(`\n${e instanceof Error ? e.message : e}\n`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
