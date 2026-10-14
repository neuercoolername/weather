import { useMemo, useState, type CSSProperties, type Ref } from "react";
import DrawnRingLoop from "@/components/DrawnRingLoop";
import { handDrawnRing, seededRandom, type RingShapeParams } from "@/lib/domain/mark-shape";
import type { RingLoopTiming } from "@/lib/domain/ring-loop";
import type { AboutParams } from "@/lib/domain/about";

const HIT_PX = 48;

// A crossing-style ring around an italic i. The ring's shape comes from a fixed seed, so
// server and client draw the same one. Growth is CSS (globals.css); while hovered or open
// the pen redraws that ring on a loop, like a hovered mark (components/DrawnRingLoop).
// Bottom-left. It sits above the trace but under both panels (z-20), so the full-screen
// mobile panels cover it.
export default function AboutButton({
  open,
  onToggle,
  params,
  ringShape,
  loopTiming,
  ref,
}: {
  open: boolean;
  onToggle: () => void;
  params: AboutParams;
  ringShape: RingShapeParams;
  loopTiming: RingLoopTiming;
  ref?: Ref<HTMLButtonElement>;
}) {
  const ring = useMemo(
    () => handDrawnRing(seededRandom(params.ringSeed), ringShape),
    [params.ringSeed, ringShape]
  );
  const [hovered, setHovered] = useState(false);
  const offset = params.ringCenterPx - HIT_PX / 2;
  const size = params.ringRadius * 2;

  return (
    <button
      ref={ref}
      onClick={onToggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-expanded={open}
      aria-label="About this page"
      title="about"
      className={`about-button absolute z-10 flex cursor-pointer items-center justify-center text-zinc-600 hover:text-zinc-900 aria-expanded:text-zinc-900 ${open ? "invisible" : ""}`}
      style={
        {
          left: offset,
          bottom: offset,
          width: HIT_PX,
          height: HIT_PX,
          "--about-grow": params.hoverGrowth,
        } as CSSProperties
      }
    >
      <span className="about-grow absolute flex">
        <svg className="overflow-visible" width={size} height={size} viewBox="-1 -1 2 2" aria-hidden>
          {hovered || open ? (
            <DrawnRingLoop
              ring={ring}
              timing={loopTiming}
              transform={`scale(${1 + params.loopGrowth})`}
              // Scaled by hand: a non-scaling stroke would break the pen's dash (see IntersectionDot).
              strokeWidth={params.ringStroke / (params.ringRadius * (1 + params.loopGrowth))}
            />
          ) : (
            <path
              d={ring.d}
              fill="none"
              stroke="currentColor"
              strokeWidth={params.ringStroke}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
      </span>
      <span
        className="relative italic leading-none -translate-y-[0.04em]"
        style={{ fontSize: params.glyphPx }}
        aria-hidden
      >
        i
      </span>
    </button>
  );
}
