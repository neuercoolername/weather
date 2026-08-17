interface Point {
  x: number;
  y: number;
}

// Serialize a polyline as an SVG path `d` string, applying the render-boundary
// y-flip (+y = north in data space, but SVG's y grows downward). The partner of
// projectToScreen in lib/camera.ts, which applies the same flip to a single point.
// Fewer than two points draws nothing, and SVG reads an empty `d` as exactly that.
export function toSvgPolyline(points: readonly Point[]): string {
  if (points.length < 2) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x},${-p.y}`).join(" ");
}
