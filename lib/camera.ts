// Camera / viewport math: mapping the trace's abstract data space onto the
// screen. Pure geometry about viewports, pixels, and the zoom transform — the
// pure counterpart of app/trace/traceCamera.ts. Distinct from lib/trace (which
// is the trace domain in data-space and knows nothing about screens).

interface Point {
  x: number;
  y: number;
}

export interface FitTransform {
  x: number;
  y: number;
  k: number;
}

// Fit all points into a viewport (with padding), matching the SVG y-flip (+y = north → up on screen).
// Returns null for empty points or a zero-sized viewport.
export function computeFitTransform(
  points: Point[],
  viewport: { width: number; height: number },
  padding: number
): FitTransform | null {
  if (points.length === 0 || viewport.width <= 0 || viewport.height <= 0) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => -p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const dataW = maxX - minX || 1;
  const dataH = maxY - minY || 1;
  const k = Math.min(
    (viewport.width - padding * 2) / dataW,
    (viewport.height - padding * 2) / dataH
  );
  const x = (viewport.width - dataW * k) / 2 - minX * k;
  const y = (viewport.height - dataH * k) / 2 - minY * k;
  return { x, y, k };
}

// Centre a data-space point in the visible area at the current zoom scale, leaving `k`
// untouched (this pans, it never zooms). `obscuredRight` is the width in pixels of an
// overlay covering the right edge — pass 0 when the overlay is full-screen or absent.
// The result is the transform under which projectToScreen(point) lands on that centre.
export function computeCenterTransform(
  point: Point,
  viewport: { width: number; height: number },
  obscuredRight: number,
  k: number
): FitTransform {
  return {
    x: (viewport.width - obscuredRight) / 2 - point.x * k,
    y: viewport.height / 2 - -point.y * k,
    k,
  };
}

// Project a data-space point to screen space under a zoom transform (applies the y-flip).
export function projectToScreen(
  point: Point,
  transform: { x: number; y: number; k: number }
): { sx: number; sy: number } {
  return {
    sx: point.x * transform.k + transform.x,
    sy: -point.y * transform.k + transform.y,
  };
}
