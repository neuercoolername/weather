import { prisma } from "@/lib/prisma";
import { getSupabase, BUCKET, SIGNED_URL_EXPIRY } from "@/lib/supabase";

const IMAGE_SELECT = {
  orderBy: { createdAt: "asc" as const },
  select: { id: true, storageKey: true, caption: true },
};

async function withSignedUrls<T extends { storageKey: string }>(
  images: T[]
): Promise<(T & { signedUrl: string })[]> {
  return Promise.all(
    images.map(async (img) => {
      const { data } = await getSupabase().storage
        .from(BUCKET)
        .createSignedUrl(img.storageKey, SIGNED_URL_EXPIRY);
      return { ...img, signedUrl: data?.signedUrl ?? "" };
    })
  );
}

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

  return Promise.all(
    intersections.map(async (ix) => ({
      ...ix,
      images: await withSignedUrls(ix.images),
    }))
  );
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
