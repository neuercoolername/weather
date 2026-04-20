import { PrismaClient } from "@prisma/client";
import { generateIntersectionText } from "../lib/intersection-text";
import { processIntersections } from "../lib/weather";

const prisma = new PrismaClient();
const withEmail = process.argv.includes("--email");

async function main() {
  const intersections = await prisma.intersection.findMany({
    where: { intersectionText: null },
    include: {
      tracePointA: { include: { snapshot: { select: { fetchedAt: true } } } },
      tracePointB: { include: { snapshot: { select: { fetchedAt: true } } } },
    },
    orderBy: { detectedAt: "asc" },
  });

  console.log(
    `[BackfillTexts] ${intersections.length} intersection(s) without text` +
      (withEmail ? " — will send emails" : "")
  );

  let generated = 0;

  for (const ix of intersections) {
    try {
      if (withEmail) {
        await processIntersections([
          {
            id: ix.id,
            dateA: ix.tracePointA.snapshot.fetchedAt,
            dateB: ix.tracePointB.snapshot.fetchedAt,
          },
        ]);
      } else {
        await generateIntersectionText(ix.id);
      }
      console.log(`[BackfillTexts] Intersection #${ix.id} — text generated`);
      generated++;
    } catch (err) {
      console.error(`[BackfillTexts] Intersection #${ix.id} — failed:`, err);
    }
  }

  console.log(`[BackfillTexts] Done — ${generated}/${intersections.length} text(s) generated`);
}

main()
  .catch((err) => {
    console.error("[BackfillTexts] Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
