// Phrases from the Beaufort wind scale. Each page load shows the one closest to the
// last 24h mean wind as the trace's headline — random among equally close phrases,
// and random from the whole list when there is no wind data.

export interface BeaufortPhrase {
  text: string;
  force: number;
  /** "wind" phrases read as "wind …"; "land" and "sea" are the scale's two descriptions */
  group: "wind" | "land" | "sea";
}

export const BEAUFORT_PHRASES: readonly BeaufortPhrase[] = [
  { text: "Felt on face", force: 2, group: "wind" },
  { text: "Extends light flag", force: 3, group: "wind" },
  // { text: "In constant motion", force: 3, group: "wind" },
  { text: "Raises dust and loose paper", force: 4, group: "wind" },
  { text: "Breaks twigs off trees", force: 8, group: "wind" },
  // { text: "Generally impedes progress", force: 8, group: "wind" },
  // { text: "Seldom experienced inland", force: 10, group: "wind" },
  // { text: "Very rarely experienced", force: 11, group: "wind" },
  // { text: "Accompanied by widespread damage", force: 11, group: "wind" },

  { text: "Smoke rises vertically", force: 0, group: "land" },
  { text: "Shown by smoke drift", force: 1, group: "land" },
  // { text: "Not by wind vanes", force: 1, group: "land" },
  { text: "Leaves rustle", force: 2, group: "land" },
  // { text: "Ordinary vane moved", force: 2, group: "land" },
  { text: "Leaves and small twigs in constant motion", force: 3, group: "land" },
  { text: "Small branches are moved", force: 4, group: "land" },
  { text: "Small trees in leaf begin to sway", force: 5, group: "land" },
  { text: "Crested wavelets form on inland waters", force: 5, group: "land" },
  { text: "Large branches in motion", force: 6, group: "land" },
  { text: "Whistling heard in telegraph wires", force: 6, group: "land" },
  { text: "Umbrellas used with difficulty", force: 6, group: "land" },
  { text: "Whole trees in motion", force: 7, group: "land" },
  { text: "Inconvenience felt when walking against the wind", force: 7, group: "land" },
  // { text: "Slight structural damage occurs", force: 9, group: "land" },
  { text: "Chimney pots and slates removed", force: 9, group: "land" },
  { text: "Trees uprooted", force: 10, group: "land" },
  // { text: "Considerable structural damage occurs", force: 10, group: "land" },

  { text: "Sea like a mirror", force: 0, group: "sea" },
  // { text: "Ripples with the appearance of scales", force: 1, group: "sea" },
  // { text: "Without foam crests", force: 1, group: "sea" },
  // { text: "Crests have a glassy appearance", force: 2, group: "sea" },
  // { text: "And do not break", force: 2, group: "sea" },
  // { text: "Crests begin to break", force: 3, group: "sea" },
  // { text: "Perhaps scattered white horses", force: 3, group: "sea" },
  // { text: "Fairly frequent white horses", force: 4, group: "sea" },
  // { text: "Chance of some spray", force: 5, group: "sea" },
  // { text: "Probably some spray", force: 6, group: "sea" },
  // { text: "Sea heaps up", force: 7, group: "sea" },
  // { text: "Blown in streaks", force: 7, group: "sea" },
  // { text: "Along the direction of the wind", force: 7, group: "sea" },
  // { text: "Crests break into spindrift", force: 8, group: "sea" },
  // { text: "Topple tumble and roll over", force: 9, group: "sea" },
  // { text: "Spray may affect visibility", force: 9, group: "sea" },
  // { text: "Takes on a white appearance", force: 10, group: "sea" },
  // { text: "Heavy and shock-like", force: 10, group: "sea" },
  // { text: "For a time lost to view", force: 11, group: "sea" },
  // { text: "Blown into froth", force: 11, group: "sea" },
  // { text: "The air is filled with foam and spray", force: 12, group: "sea" },
  // { text: "Visibility very seriously affected", force: 12, group: "sea" },
];

export function randomPhrase(rand: () => number = Math.random): BeaufortPhrase {
  return BEAUFORT_PHRASES[Math.floor(rand() * BEAUFORT_PHRASES.length)];
}

/**
 * Continuous Beaufort force for a wind speed in km/h, from the scale's defining
 * relation v = 0.836 · B^1.5 (m/s), clamped to 0–12. Rounded, it is the familiar
 * force number; the fraction lets the speed decide which side of a gap is nearer.
 */
export function beaufortForce(kmh: number): number {
  const ms = Math.max(0, kmh) / 3.6;
  return Math.min(12, (ms / 0.836) ** (2 / 3));
}

/**
 * The phrase whose force is nearest `force`; random among all equally near, so a
 * force with several phrases varies between page loads. Gaps in the list resolve
 * to the nearest force on either side.
 */
export function closestPhrase(
  force: number,
  rand: () => number = Math.random,
  phrases: readonly BeaufortPhrase[] = BEAUFORT_PHRASES
): BeaufortPhrase {
  const best = Math.min(...phrases.map((p) => Math.abs(p.force - force)));
  const nearest = phrases.filter((p) => Math.abs(p.force - force) === best);
  return nearest[Math.floor(rand() * nearest.length)];
}
