import { prisma } from "@/lib/prisma";

async function main() {
  const result = await prisma.intersectionText.deleteMany({});
  console.log(`Deleted ${result.count} intersection text(s).`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
