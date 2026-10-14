// The About button and panel: tuned values (pure / no DOM).
// Tuned in the prototype; see docs/features/about-overlay.

export interface AboutParams {
  /** distance from the page's left and bottom edges to the ring's centre, px */
  ringCenterPx: number;
  /** ring radius, px */
  ringRadius: number;
  /** ring stroke, px */
  ringStroke: number;
  /** size of the italic i inside the ring, px */
  glyphPx: number;
  /** ring scale while hovered or open */
  hoverGrowth: number;
  /** while hovered or open the ring is redrawn on a loop this much larger, fraction of the hovered size */
  loopGrowth: number;
  /** seed for the ring's hand-drawn shape, so it is the one picked in the prototype */
  ringSeed: number;
  /** panel slide in/out, ms */
  slideMs: number;
  /** copy size, px */
  textPx: number;
  /** width of the text column, in the copy's characters */
  measureCh: number;
  /** space between the text column and the close button, px */
  closeGapPx: number;
}

export const DEFAULT_ABOUT_PARAMS: AboutParams = {
  ringCenterPx: 31,
  ringRadius: 15,
  ringStroke: 1,
  glyphPx: 17,
  hoverGrowth: 1.12,
  loopGrowth: 0.12,
  ringSeed: 7,
  slideMs: 320,
  textPx: 15,
  measureCh: 46,
  closeGapPx: 16,
};
