"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  intersectionId: number;
  image: {
    id: string;
    caption: string | null;
    signedUrl: string;
  };
}

type SaveStatus = "idle" | "saving" | "saved";

export default function ImageItem({ intersectionId, image }: Props) {
  const router = useRouter();
  const [captionStatus, setCaptionStatus] = useState<SaveStatus>("idle");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleCaptionChange(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setCaptionStatus("saving");
    debounceRef.current = setTimeout(async () => {
      await fetch(`/api/admin/intersections/${intersectionId}/images/${image.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption: value || null }),
      });
      setCaptionStatus("saved");
      setTimeout(() => setCaptionStatus("idle"), 2000);
    }, 1500);
  }

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
        alt={image.caption ?? ""}
        className="max-w-full max-h-96 object-contain"
      />
      <div className="flex items-baseline gap-4">
        <input
          type="text"
          defaultValue={image.caption ?? ""}
          onChange={(e) => handleCaptionChange(e.target.value)}
          placeholder="caption"
          className="flex-1 border-b border-zinc-200 bg-transparent text-sm py-0.5 outline-none placeholder:text-zinc-400"
        />
        <span className="text-xs text-zinc-400 w-10">
          {captionStatus === "saving" && "saving…"}
          {captionStatus === "saved" && "saved"}
        </span>
        {confirmDelete ? (
          <span className="text-sm space-x-3">
            <button
              onClick={handleDelete}
              className="text-red-600 hover:text-red-800"
            >
              confirm delete
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-zinc-400 hover:text-zinc-700"
            >
              cancel
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-sm text-zinc-400 hover:text-zinc-700"
          >
            delete
          </button>
        )}
      </div>
    </div>
  );
}
