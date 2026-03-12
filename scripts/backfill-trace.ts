import { PrismaClient } from "@prisma/client";
import { computeTracePoint, detectAndStoreIntersections } from "../lib/trace";

const prisma = new PrismaClient();

async function main() {
  const snapshots = await prisma.weatherSnapshot.findMany({
    where: { tracePoint: null },
    orderBy: { fetchedAt: "asc" },
    select: { id: true, rawJson: true },
  });

  console.log(`[Backfill] ${snapshots.length} snapshot(s) without a trace point`);

  let created = 0;

  for (const snapshot of snapshots) {
    const raw = snapshot.rawJson as { current?: { wind_direction_10m?: number; wind_speed_10m?: number } };
    const windDir = raw.current?.wind_direction_10m;
    const windSpeed = raw.current?.wind_speed_10m;

    if (windDir === undefined || windSpeed === undefined) {
      console.log(`[Backfill] Snapshot #${snapshot.id} — missing wind data, skipping`);
      continue;
    }

    const prev = await prisma.tracePoint.findFirst({ orderBy: { createdAt: "desc" } });
    const prevX = prev?.x ?? 0;
    const prevY = prev?.y ?? 0;

    const { x, y } = computeTracePoint(prevX, prevY, windDir, windSpeed);
    const tracePoint = await prisma.tracePoint.create({
      data: { snapshotId: snapshot.id, x, y },
    });

    await detectAndStoreIntersections(tracePoint.id, prevX, prevY, x, y);

    console.log(`[Backfill] Snapshot #${snapshot.id} → TracePoint #${tracePoint.id} (${x.toFixed(2)}, ${y.toFixed(2)})`);
    created++;
  }

  console.log(`[Backfill] Done — ${created} trace point(s) created`);
}

main()
  .catch((err) => {
    console.error("[Backfill] Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
