"use client";

import { useEffect, useState } from "react";

interface Image {
  id: string;
  caption: string | null;
  signedUrl: string;
}

interface Intersection {
  id: number;
  text: string | null;
  tracePointA: { snapshot: { fetchedAt: Date } };
  tracePointB: { snapshot: { fetchedAt: Date } };
  images: Image[];
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function IntersectionPanel({
  intersection,
  onClose,
}: {
  intersection: Intersection;
  onClose: () => void;
}) {
  const [expandedImage, setExpandedImage] = useState<Image | null>(null);

  useEffect(() => {
    if (!expandedImage) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setExpandedImage(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expandedImage]);

  const dateLabel = `${formatDate(intersection.tracePointA.snapshot.fetchedAt)} × ${formatDate(intersection.tracePointB.snapshot.fetchedAt)}`;

  return (
    <>
      <div
        className="absolute bottom-0 left-0 right-0 bg-white border-t border-zinc-200 p-6 max-h-[50vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="flex items-baseline justify-between">
            <p className="text-sm text-zinc-500">{dateLabel}</p>
            <button
              onClick={onClose}
              className="text-sm text-zinc-400 hover:text-zinc-900"
            >
              close
            </button>
          </div>

          {intersection.text && (
            <p className="text-sm leading-relaxed">{intersection.text}</p>
          )}

          {intersection.images.length > 0 && (
            <div className="flex gap-4 overflow-x-auto pb-1">
              {intersection.images.map((img) => (
                <figure key={img.id} className="shrink-0 space-y-1">
                  <img
                    src={img.signedUrl}
                    alt={img.caption ?? ""}
                    className="h-40 w-auto object-contain cursor-pointer"
                    onClick={() => setExpandedImage(img)}
                  />
                  {img.caption && (
                    <figcaption className="text-xs text-zinc-400">
                      {img.caption}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          )}
        </div>
      </div>

      {expandedImage && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center"
          onClick={() => setExpandedImage(null)}
        >
          <img
            src={expandedImage.signedUrl}
            alt={expandedImage.caption ?? ""}
            className="max-h-screen max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {expandedImage.caption && (
            <p className="mt-3 text-sm text-zinc-400">{expandedImage.caption}</p>
          )}
        </div>
      )}
    </>
  );
}
