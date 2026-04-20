import { prisma } from "@/lib/prisma";

async function main() {
  const intersectionTexts = await prisma.intersectionText.deleteMany({});
  const intersections = await prisma.intersection.deleteMany({});
  const tracePoints = await prisma.tracePoint.deleteMany({});
  console.log(
    `Deleted ${intersectionTexts.count} intersection text(s), ${intersections.count} intersection(s), and ${tracePoints.count} trace point(s).`
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
