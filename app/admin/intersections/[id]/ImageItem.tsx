"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  intersectionId: number;
  image: {
    id: string;
    signedUrl: string;
  };
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
      <img
        src={image.signedUrl}
        alt=""
        className="max-w-full max-h-96 object-contain"
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
