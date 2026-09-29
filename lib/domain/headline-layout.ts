// How the flow-field headline sets its text. Every title shares one fixed size, so the page
// reads the same whatever phrase it drew; a sentence takes its natural width, and one wider
// than the window fades out before the edge instead of shrinking. Tuned in a bench against
// every Beaufort phrase: at 64px, 46 of the 49 fit a 1440px window.

export interface HeadlineLayoutParams {
  fontPx: number;
  /** space kept clear at the left, and at the right while the text fits */
  gutterPx: number;
  /** length of the fade-out, ending at the window edge, for text wider than the window */
  fadePx: number;
  /** containers narrower than this get the compact headline (the fallback word) */
  compactMaxWidth: number;
}

export const DEFAULT_HEADLINE_LAYOUT: HeadlineLayoutParams = {
  fontPx: 64,
  gutterPx: 24,
  fadePx: 160,
  compactMaxWidth: 1024,
};

/** Phones and tablets: too narrow for a phrase, or no hover to reveal a crossing's dates. */
export function isCompactHeadline(
  containerWidth: number,
  noHover: boolean,
  params: HeadlineLayoutParams
): boolean {
  return noHover || containerWidth < params.compactMaxWidth;
}
