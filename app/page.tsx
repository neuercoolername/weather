import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function Home() {
  const snapshot = await prisma.weatherSnapshot.findFirst({
    orderBy: { fetchedAt: "desc" },
    include: { haiku: true },
  });

  if (!snapshot?.haiku) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg">
          Waiting for first weather update...
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <main className="flex flex-col items-center gap-8 p-8">
        <p className="whitespace-pre-line text-2xl font-light italic leading-relaxed tracking-wide">
          {snapshot.haiku.text}
        </p>
      </main>
    </div>
  );
}
