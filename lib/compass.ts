const DIRS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

export function degreesToCompassPoint(deg: number): string {
  return DIRS[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
}

export function formatWindLabel(deg: number, speedKph: number): string {
  return `${degreesToCompassPoint(deg)} ${Math.round(speedKph)} km/h`;
}
