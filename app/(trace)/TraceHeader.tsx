"use client";

import { memo } from "react";
import type { WindField } from "@/lib/domain/wind-field";
import FlowFieldHeadline from "./FlowFieldHeadline";

// The wind reading drives the field's *motion*; the text comes from what the viewer
// is pointing at (`traceHeadline`, chosen by TraceSVG). Taking it as a plain string
// is what keeps the memo below working — it compares by value, so the headline does
// not re-render on every zoom frame.
function TraceHeader({ windField, text }: { windField: WindField | null; text: string }) {
  return (
    <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none px-6 py-4">
      <FlowFieldHeadline text={text} field={windField} />
    </div>
  );
}

export default memo(TraceHeader);
