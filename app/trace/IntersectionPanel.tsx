"use client";

import { memo, useEffect, useState } from "react";
import type { IntersectionWithImages, IntersectionImage } from "@/lib/intersections";
import PanelNav from "./PanelNav";
import IntersectionImages from "./IntersectionImages";
import ImageLightbox from "./ImageLightbox";

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function IntersectionPanel({
  intersection,
  onClose,
  onPrev,
  onNext,
}: {
  intersection: IntersectionWithImages;
  onClose: () => void;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
}) {
  const [expandedImage, setExpandedImage] = useState<IntersectionImage | null>(null);

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
        className="fixed z-20 top-0 right-0 bottom-0 left-0 md:left-auto flex flex-col md:absolute md:w-[33vw] bg-white md:border-l border-zinc-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500 font-mono tabular-nums">{dateLabel}</p>
            {/* Desktop: nav sits inline with the date label */}
            <div className="hidden md:flex items-center gap-1 text-zinc-400">
              <PanelNav onPrev={onPrev} onNext={onNext} onClose={onClose} />
            </div>
          </div>

          {intersection.text && (
            <p className="text-sm leading-relaxed whitespace-pre-line">
              {intersection.text}
            </p>
          )}

          {intersection.images.length > 0 && (
            <IntersectionImages images={intersection.images} onExpand={setExpandedImage} />
          )}
        </div>

        {/* Mobile: nav lives in a bottom bar, within thumb's reach */}
        <div className="shrink-0 border-t border-zinc-200 p-2 flex items-center justify-center gap-6 text-zinc-400 md:hidden">
          <PanelNav onPrev={onPrev} onNext={onNext} onClose={onClose} />
        </div>
      </div>

      {expandedImage && (
        <ImageLightbox image={expandedImage} onClose={() => setExpandedImage(null)} />
      )}
    </>
  );
}

export default memo(IntersectionPanel);
