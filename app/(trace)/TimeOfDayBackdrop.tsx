import type { TimeOfDayLook } from "@/lib/domain/time-of-day";

interface Props {
  look: TimeOfDayLook | null;
}

// Fixed behind everything else on the page (z-index in globals.css), so it never needs to know
// about the trace's camera or layout. Pure CSS animation — no controller needed, unlike the marks'
// breathing, since there's one instance with no per-mark phase to stagger.
export default function TimeOfDayBackdrop({ look }: Props) {
  if (!look) return null;

  return (
    <div
      aria-hidden
      className="time-of-day-backdrop"
      style={{
        background: look.background,
        animationDuration: `${look.breatheSeconds}s`,
      }}
    />
  );
}
