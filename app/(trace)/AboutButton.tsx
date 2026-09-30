import { useMemo, type CSSProperties, type Ref } from "react";
import { handDrawnRingPath, seededRandom, type RingShapeParams } from "@/lib/domain/mark-shape";
import type { AboutParams } from "@/lib/domain/about";

const HIT_PX = 48;

// A crossing-style ring around an italic i. The ring's shape comes from a fixed seed, so
// server and client draw the same one. Growth and breathing are CSS (globals.css): the
// outer layer grows on hover/open, the inner one breathes, so breathing starts from rest.
export default function AboutButton({
  open,
  onToggle,
  params,
  ringShape,
  ref,
}: {
  open: boolean;
  onToggle: () => void;
  params: AboutParams;
  ringShape: RingShapeParams;
  ref?: Ref<HTMLButtonElement>;
}) {
  const ringPath = useMemo(
    () => handDrawnRingPath(seededRandom(params.ringSeed), ringShape),
    [params.ringSeed, ringShape]
  );
  const offset = params.ringCenterPx - HIT_PX / 2;
  const size = params.ringRadius * 2;

  return (
    <button
      ref={ref}
      onClick={onToggle}
      aria-expanded={open}
      aria-label="About this page"
      title="about"
      className={`about-button absolute z-30 flex items-center justify-center text-zinc-600 hover:text-zinc-900 aria-expanded:text-zinc-900 ${open ? "max-md:invisible" : ""}`}
      style={
        {
          left: offset,
          bottom: offset,
          width: HIT_PX,
          height: HIT_PX,
          "--about-grow": params.hoverGrowth,
          "--about-peak": 1 + params.pulseDepth,
          "--about-period": `${params.pulsePeriodSec}s`,
        } as CSSProperties
      }
    >
      <span className="about-grow absolute flex">
        <svg
          className="about-breathe overflow-visible"
          width={size}
          height={size}
          viewBox="-1 -1 2 2"
          aria-hidden
        >
          <path
            d={ringPath}
            fill="none"
            stroke="currentColor"
            strokeWidth={params.ringStroke}
            vectorEffect="non-scaling-stroke"
          />
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
