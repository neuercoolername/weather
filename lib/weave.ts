export const GAP_SIZE = 10; // content-space units

interface Point {
  x: number;
  y: number;
}

export interface SubSegment {
  start: Point;
  end: Point;
}

function dist(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function computeWeaveSegments(
  tracePoints: { id: number; x: number; y: number }[],
  intersections: { x: number; y: number; tracePointIdA: number; tracePointIdB: number }[],
  gapSize: number = GAP_SIZE,
): SubSegment[] {
  if (tracePoints.length < 2) return [];

  const gapHalf = gapSize / 2;

  // Map trace point id → index
  const idToIndex = new Map(tracePoints.map((p, i) => [p.id, i]));

  // Collect under-crossing points per segment index
  const crossingsPerSeg = new Map<number, Point[]>();
  for (const ix of intersections) {
    const ia = idToIndex.get(ix.tracePointIdA);
    if (ia === undefined || ia === 0) continue;
    const segIdx = ia - 1;
    if (!crossingsPerSeg.has(segIdx)) crossingsPerSeg.set(segIdx, []);
    crossingsPerSeg.get(segIdx)!.push({ x: ix.x, y: ix.y });
  }

  const result: SubSegment[] = [];

  for (let i = 0; i < tracePoints.length - 1; i++) {
    const A = { x: tracePoints[i].x, y: tracePoints[i].y };
    const B = { x: tracePoints[i + 1].x, y: tracePoints[i + 1].y };

    const crossings = crossingsPerSeg.get(i);
    if (!crossings || crossings.length === 0) {
      result.push({ start: A, end: B });
      continue;
    }

    const segLen = dist(A, B);
    if (segLen === 0) {
      result.push({ start: A, end: B });
      continue;
    }

    // Unit vector along segment
    const dx = (B.x - A.x) / segLen;
    const dy = (B.y - A.y) / segLen;

    // Sort crossings along the segment direction
    crossings.sort((c1, c2) => {
      return ((c1.x - A.x) * dx + (c1.y - A.y) * dy) - ((c2.x - A.x) * dx + (c2.y - A.y) * dy);
    });

    // Walk through: A → [crossing gaps] → B
    // pts = [A, c1, c2, ..., B]
    const pts: Point[] = [A, ...crossings, B];
    let from = A;

    for (let j = 1; j < pts.length; j++) {
      const to = pts[j];
      const isLastPoint = j === pts.length - 1;

      if (isLastPoint) {
        // Final piece — draw straight to B
        result.push({ start: from, end: B });
      } else {
        // to is a crossing — gap each side independently, capped to available space
        const distBefore = dist(from, to);
        const distAfter = dist(to, pts[j + 1]);
        const gBefore = Math.min(gapHalf, distBefore);
        const gAfter  = Math.min(gapHalf, distAfter);

        result.push({ start: from, end: { x: to.x - dx * gBefore, y: to.y - dy * gBefore } });
        from = { x: to.x + dx * gAfter, y: to.y + dy * gAfter };
      }
    }
  }

  return result;
}

// Groups sub-segments into SVG path strings, starting a new path whenever
// there is a gap between consecutive sub-segments.
export function buildWeavePaths(subSegments: SubSegment[], flipY = false): string[] {
  if (subSegments.length === 0) return [];

  const fmt = (p: Point) => `${p.x},${flipY ? -p.y : p.y}`;

  const paths: string[] = [];
  let current = `M ${fmt(subSegments[0].start)} L ${fmt(subSegments[0].end)}`;

  for (let i = 1; i < subSegments.length; i++) {
    const prev = subSegments[i - 1];
    const cur = subSegments[i];
    const connected =
      Math.abs(prev.end.x - cur.start.x) < 1e-9 &&
      Math.abs(prev.end.y - cur.start.y) < 1e-9;
    if (connected) {
      current += ` L ${fmt(cur.end)}`;
    } else {
      paths.push(current);
      current = `M ${fmt(cur.start)} L ${fmt(cur.end)}`;
    }
  }
  paths.push(current);

  return paths;
}
