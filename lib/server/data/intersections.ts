import "server-only";

import { prisma } from "@/lib/server/prisma";
import { signedUrlsFor } from "@/lib/server/image-urls";

const IMAGE_SELECT = {
  orderBy: { createdAt: "asc" as const },
  select: {
    id: true,
    storageKey: true,
    width: true,
    height: true,
  },
};

async function withSignedUrls<T extends { storageKey: string }>(
  images: T[]
): Promise<(T & { signedUrl: string })[]> {
  const urls = await signedUrlsFor(images.map((img) => img.storageKey));
  return images.map((img) => ({
    ...img,
    signedUrl: urls.get(img.storageKey) ?? "",
  }));
}

// The intersection shape the public trace renders — derived from the query below
// (single source of truth: it follows the Prisma `select` automatically).
export type IntersectionWithImages = Awaited<
  ReturnType<typeof getAllIntersectionsWithImages>
>[number];
export type IntersectionImage = IntersectionWithImages["images"][number];

export async function getAllIntersectionsWithImages() {
  const intersections = await prisma.intersection.findMany({
    select: {
      id: true,
      x: true,
      y: true,
      text: true,
      tracePointIdA: true,
      tracePointIdB: true,
      tracePointA: { select: { snapshot: { select: { fetchedAt: true } } } },
      tracePointB: { select: { snapshot: { select: { fetchedAt: true } } } },
      images: IMAGE_SELECT,
    },
  });

  // One signing call for every image on the page, not one per intersection.
  const urls = await signedUrlsFor(
    intersections.flatMap((ix) => ix.images.map((img) => img.storageKey))
  );

  return intersections.map((ix) => ({
    ...ix,
    images: ix.images.map((img) => ({
      ...img,
      signedUrl: urls.get(img.storageKey) ?? "",
    })),
  }));
}

export async function getAdjacentIntersectionIds(
  id: number,
  detectedAt: Date
): Promise<{ prevId: number | null; nextId: number | null }> {
  // Compound (detectedAt, id) cursor — a plain gt/lt on detectedAt skips over
  // rows that share an identical timestamp with the current one.
  const [prev, next] = await Promise.all([
    prisma.intersection.findFirst({
      where: {
        OR: [{ detectedAt: { gt: detectedAt } }, { detectedAt, id: { gt: id } }],
      },
      orderBy: [{ detectedAt: "asc" }, { id: "asc" }],
      select: { id: true },
    }),
    prisma.intersection.findFirst({
      where: {
        OR: [{ detectedAt: { lt: detectedAt } }, { detectedAt, id: { lt: id } }],
      },
      orderBy: [{ detectedAt: "desc" }, { id: "desc" }],
      select: { id: true },
    }),
  ]);
  return { prevId: prev?.id ?? null, nextId: next?.id ?? null };
}

export async function getIntersectionWithImages(id: number) {
  const intersection = await prisma.intersection.findUnique({
    where: { id },
    select: {
      id: true,
      x: true,
      y: true,
      text: true,
      detectedAt: true,
      tracePointA: { select: { snapshot: { select: { fetchedAt: true } } } },
      tracePointB: { select: { snapshot: { select: { fetchedAt: true } } } },
      images: IMAGE_SELECT,
    },
  });

  if (!intersection) return null;

  return {
    ...intersection,
    images: await withSignedUrls(intersection.images),
  };
}
