"use client";

export default function IntersectionNav({
  prevId,
  nextId,
}: {
  prevId: number | null;
  nextId: number | null;
}) {
  return (
    <div className="flex items-center gap-3 text-xs text-zinc-400">
      {prevId !== null ? (
        <a
          href={`/admin/intersections/${prevId}`}
          className="hover:text-zinc-900 transition-colors"
          title="newer"
        >
          ‹ #{prevId}
        </a>
      ) : (
        <span className="opacity-30">‹</span>
      )}
      <span className="opacity-20">·</span>
      {nextId !== null ? (
        <a
          href={`/admin/intersections/${nextId}`}
          className="hover:text-zinc-900 transition-colors"
          title="older"
        >
          #{nextId} ›
        </a>
      ) : (
        <span className="opacity-30">›</span>
      )}
    </div>
  );
}
