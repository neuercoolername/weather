import { describe, it, expect } from "vitest";
import { traceHeadline, type HeadlineCrossing } from "./trace-headline";

const crossing = (a: string, b: string): HeadlineCrossing => ({
  tracePointA: { snapshot: { fetchedAt: new Date(a) } },
  tracePointB: { snapshot: { fetchedAt: new Date(b) } },
});

describe("traceHeadline", () => {
  it("falls back to the trace's own name when nothing is pointed at", () => {
    expect(traceHeadline(null, 0)).toBe("Wind");
    expect(traceHeadline(null, 3)).toBe("Wind");
  });

  it("names a lone crossing by its two dates", () => {
    expect(traceHeadline(crossing("2026-02-18T14:00:00", "2026-04-04T09:00:00"), 0)).toBe(
      "18/2/26 × 4/4/26"
    );
  });

  it("keeps the dates in the order they are stored, not sorted", () => {
    expect(traceHeadline(crossing("2026-04-04T09:00:00", "2026-02-18T14:00:00"), 0)).toBe(
      "4/4/26 × 18/2/26"
    );
  });

  it("counts the crossings a merged ring holds behind this one", () => {
    const c = crossing("2026-02-18T14:00:00", "2026-04-04T09:00:00");
    expect(traceHeadline(c, 1)).toBe("18/2/26 × 4/4/26 +1");
    expect(traceHeadline(c, 2)).toBe("18/2/26 × 4/4/26 +2");
  });

  it("drops no leading zeros and pads the year", () => {
    expect(traceHeadline(crossing("2026-01-07T00:00:00", "2026-12-31T23:00:00"), 0)).toBe(
      "7/1/26 × 31/12/26"
    );
    expect(traceHeadline(crossing("2005-03-09T00:00:00", "2005-03-09T00:00:00"), 0)).toBe(
      "9/3/05 × 9/3/05"
    );
  });
});
