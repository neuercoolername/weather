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
  onPrev,
  onNext,
}: {
  intersection: Intersection;
  onClose: () => void;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
}) {
  const [expandedImage, setExpandedImage] = useState<Image | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (expandedImage) setExpandedImage(null);
        else onClose();
      } else if (e.key === "ArrowLeft") {
        onPrev?.();
      } else if (e.key === "ArrowRight") {
        onNext?.();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expandedImage, onClose, onPrev, onNext]);

  const dateLabel = `${formatDate(intersection.tracePointA.snapshot.fetchedAt)} × ${formatDate(intersection.tracePointB.snapshot.fetchedAt)}`;

  return (
    <>
      <div
        className="absolute top-0 right-0 bottom-0 w-[33vw] bg-white border-l border-zinc-200 p-6 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500">{dateLabel}</p>
            <div className="flex items-center gap-1 text-zinc-400">
              <button
                onClick={onPrev ?? undefined}
                disabled={onPrev === null}
                className="w-12 h-12 flex items-center justify-center text-xl hover:text-zinc-900 disabled:opacity-20"
                title="previous (←)"
              >
                ←
              </button>
              <button
                onClick={onNext ?? undefined}
                disabled={onNext === null}
                className="w-12 h-12 flex items-center justify-center text-xl hover:text-zinc-900 disabled:opacity-20"
                title="next (→)"
              >
                →
              </button>
              <button
                onClick={onClose}
                className="w-12 h-12 flex items-center justify-center text-xl hover:text-zinc-900"
              >
                ✕
              </button>
            </div>
          </div>

          {intersection.text && (
            <p className="text-sm leading-relaxed">{intersection.text}</p>
          )}

          {intersection.images.length > 0 && (
            <div className="space-y-4">
              {intersection.images.map((img) => (
                <figure key={img.id} className="space-y-1">
                  <img
                    src={img.signedUrl}
                    alt={img.caption ?? ""}
                    className="w-full max-h-[60vh] object-contain cursor-pointer"
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
