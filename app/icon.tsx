import { ImageResponse } from "next/og";
import { getCurrentWindField } from "@/lib/server/data/wind";
import { CALM_WIND_FIELD } from "@/lib/domain/flow-field";
import { windGlyphPath, type WindGlyphParams } from "@/lib/domain/wind-glyph";

export const dynamic = "force-dynamic";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Ink on paper, like the trace. The paper ground is what keeps the stroke
// legible on a dark tab bar as well as a light one.
const ICON = {
  paper: "#f6f4ef",
  ink: "#1a1a1a",
  radius: 6,
};

const GLYPH: Partial<WindGlyphParams> = {
  size: size.width,
  len: 23,
  weight: 4.2,
  tipRatio: 0.18,
};

export default async function Icon() {
  const field = (await getCurrentWindField()) ?? CALM_WIND_FIELD;

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: ICON.paper,
        borderRadius: ICON.radius,
      }}
    >
      <svg width={size.width} height={size.height} viewBox={`0 0 ${size.width} ${size.height}`}>
        <path d={windGlyphPath(field.dirDeg, GLYPH)} fill={ICON.ink} />
      </svg>
    </div>,
    size
  );
}
