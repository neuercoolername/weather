"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ImageFrame from "@/components/ImageFrame";
import type { IntersectionImage } from "@/lib/server/data/intersections";

interface Props {
  intersectionId: number;
  image: IntersectionImage;
}

export default function ImageItem({ intersectionId, image }: Props) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleDelete() {
    await fetch(`/api/admin/intersections/${intersectionId}/images/${image.id}`, {
      method: "DELETE",
    });
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <ImageFrame
        src={image.signedUrl}
        width={image.width}
        height={image.height}
        eager
        frameClassName="relative max-w-full max-h-96"
        className="object-contain"
      />
      <div className="flex items-baseline gap-4">
        {confirmDelete ? (
          <span className="text-sm space-x-3">
            <button
              onClick={handleDelete}
              className="text-red-600 hover:text-red-800 inline-block p-3 -m-3"
            >
              confirm delete
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-zinc-400 hover:text-zinc-700 inline-block p-3 -m-3"
            >
              cancel
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-sm text-zinc-400 hover:text-zinc-700 inline-block p-3 -m-3"
          >
            delete
          </button>
        )}
      </div>
    </div>
  );
}
