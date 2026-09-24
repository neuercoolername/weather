export type TimeOfDayBucketName =
  | "late-night"
  | "dawn"
  | "morning"
  | "midday"
  | "afternoon"
  | "evening"
  | "dusk"
  | "night";

interface BucketConfig {
  name: TimeOfDayBucketName;
  /** Local hour, inclusive. A bucket that wraps past midnight (night) uses `to` > 24. */
  from: number;
  /** Local hour, exclusive. */
  to: number;
  /** Hex stops for a `linear-gradient`, evenly spaced. */
  stops: string[];
  breatheSeconds: number;
}

export interface TimeOfDayConfig {
  angleDeg: number;
  buckets: BucketConfig[];
}

export interface TimeOfDayLook {
  name: TimeOfDayBucketName;
  /** Ready-to-use CSS `background` value. */
  background: string;
  breatheSeconds: number;
}

// Ported from the reference globals.css: eight near-white atmospheric buckets, each with its
// own slow "breathe" pulse (see TimeOfDayBackdrop). Hour ranges match the original hook's.
export const DEFAULT_TIME_OF_DAY_CONFIG: TimeOfDayConfig = {
  angleDeg: 135,
  buckets: [
    {
      name: "late-night",
      from: 2,
      to: 5,
      breatheSeconds: 22,
      stops: ["#e8e6ea", "#dfdce2", "#d6d2da", "#cdc8d2", "#c4beca"],
    },
    {
      name: "dawn",
      from: 5,
      to: 7,
      breatheSeconds: 15,
      stops: ["#fdf8f6", "#fcf4f1", "#fbf0ec", "#faf6f3", "#f9f7f5"],
    },
    {
      name: "morning",
      from: 7,
      to: 11,
      breatheSeconds: 12,
      stops: ["#fffef8", "#fefcf0", "#fdf9e8", "#fcf6e0", "#fbf3d8"],
    },
    {
      name: "midday",
      from: 11,
      to: 15,
      breatheSeconds: 18,
      stops: ["#fdfdfd", "#fafbfc", "#f6f8fa", "#f1f4f6", "#ecf0f2"],
    },
    {
      name: "afternoon",
      from: 15,
      to: 17,
      breatheSeconds: 14,
      stops: ["#fffef7", "#fefcf0", "#fdf9e8", "#fcf5df", "#fbf1d6"],
    },
    {
      name: "evening",
      from: 17,
      to: 19,
      breatheSeconds: 16,
      stops: ["#faf8f6", "#f6f3f0", "#f2eeea", "#eee9e4", "#eae4de"],
    },
    {
      name: "dusk",
      from: 19,
      to: 21,
      breatheSeconds: 13,
      stops: ["#f4f2f6", "#f0edf2", "#ece8ee", "#e8e3ea", "#e4dee6"],
    },
    {
      name: "night",
      from: 21,
      to: 26,
      breatheSeconds: 20,
      stops: ["#eeecf0", "#e6e3e9", "#dedae2", "#d6d1db", "#cec8d4"],
    },
  ],
};

function cssGradient(stops: string[], angleDeg: number): string {
  const last = stops.length - 1;
  const withPositions = stops
    .map((color, i) => `${color} ${Math.round((i / last) * 100)}%`)
    .join(", ");
  return `linear-gradient(${angleDeg}deg, ${withPositions})`;
}

/**
 * Resolves a local hour (0-23, fractional allowed) at the tracked location to its atmospheric
 * bucket. Hours before the first bucket's start (e.g. 0-2am) fold into the wrapping "night"
 * bucket, same as the original hook's `hour >= 21 || hour < 2`.
 */
export function resolveTimeOfDay(
  hour: number,
  config: TimeOfDayConfig = DEFAULT_TIME_OF_DAY_CONFIG
): TimeOfDayLook {
  const dayStart = config.buckets[0].from;
  const normalized = hour < dayStart ? hour + 24 : hour;
  const bucket =
    config.buckets.find((b) => normalized >= b.from && normalized < b.to) ??
    config.buckets[config.buckets.length - 1];

  return {
    name: bucket.name,
    background: cssGradient(bucket.stops, config.angleDeg),
    breatheSeconds: bucket.breatheSeconds,
  };
}
