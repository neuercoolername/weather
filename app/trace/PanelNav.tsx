// Prev / next / close controls for the intersection panel. Rendered both in the
// desktop header row and the mobile bottom bar, so it's a fragment (no container).

export default function PanelNav({
  onPrev,
  onNext,
  onClose,
}: {
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  onClose: () => void;
}) {
  return (
    <>
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
    </>
  );
}
