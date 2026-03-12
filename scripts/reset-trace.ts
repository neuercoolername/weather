import { prisma } from "@/lib/prisma";

async function main() {
  const intersections = await prisma.intersection.deleteMany({});
  const tracePoints = await prisma.tracePoint.deleteMany({});
  console.log(
    `Deleted ${intersections.count} intersection(s) and ${tracePoints.count} trace point(s).`
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
