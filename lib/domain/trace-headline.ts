// The text on the flow-field headline. It is the trace's only preview title — the
// marks carry no tooltip — so it says one of three things: nothing is pointed at,
// this crossing, or this crossing and how many more share its ring.

export interface HeadlineCrossing {
  tracePointA: { snapshot: { fetchedAt: Date } };
  tracePointB: { snapshot: { fetchedAt: Date } };
}

// Compact date: D/M/YY, no leading zeros, 2-digit year (e.g. 4/4/26).
function formatCompactDate(d: Date): string {
  const dt = new Date(d);
  const yy = String(dt.getFullYear() % 100).padStart(2, "0");
  return `${dt.getDate()}/${dt.getMonth() + 1}/${yy}`;
}

/**
 * `null` → "Trace"; a crossing → "D/M/YY × D/M/YY"; plus " +n" when `extra`
 * further crossings sit behind it in the same ring.
 *
 * A merged ring keeps the crossing grammar rather than reporting its date span:
 * the span would name an interval nothing happened over, and reads too easily as
 * the `×` form. The caller picks the crossing (`groupKey`), so a merged title
 * always names the one a click on that ring can actually open.
 */
export function traceHeadline(crossing: HeadlineCrossing | null, extra: number): string {
  if (!crossing) return "Trace";

  const a = formatCompactDate(crossing.tracePointA.snapshot.fetchedAt);
  const b = formatCompactDate(crossing.tracePointB.snapshot.fetchedAt);
  return extra > 0 ? `${a} × ${b} +${extra}` : `${a} × ${b}`;
}
