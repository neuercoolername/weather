"use client";

import { useEffect, useRef } from "react";
import { Archivo_Black } from "next/font/google";
import type { WindField } from "@/lib/domain/wind-field";
import type { FlowFieldParams } from "@/lib/domain/flow-field";
import type { HeadlineLayoutParams } from "@/lib/domain/headline-layout";
import {
  createFlowFieldRenderer,
  type FlowFieldRenderer,
  type FlowFieldRendererOpts,
} from "./flow-field-renderer";

// Heavy stencil face for the letterform mask.
const stencil = Archivo_Black({ weight: "400", subsets: ["latin"], display: "swap" });

const FALLBACK = "Wind";

export default function FlowFieldHeadline({
  text,
  field,
  params,
  layout,
}: {
  text: string;
  field: WindField | null;
  params?: Partial<FlowFieldParams>;
  layout?: Partial<HeadlineLayoutParams>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<FlowFieldRenderer | null>(null);

  // Capture the mount-time options once (lazy ref init — no writes during later renders).
  const initialOptsRef = useRef<FlowFieldRendererOpts | null>(null);
  if (initialOptsRef.current === null) {
    initialOptsRef.current = {
      text,
      fallback: FALLBACK,
      field,
      params,
      layout,
      fontFamily: stencil.style.fontFamily,
    };
  }

  // Lifecycle: one canvas renderer (the external system) for the component's life.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = createFlowFieldRenderer(canvas, initialOptsRef.current!);
    rendererRef.current = renderer;
    return () => {
      renderer.destroy();
      rendererRef.current = null;
    };
  }, []);

  // Sync prop changes into the renderer (cheap; re-lays the text only when it or the layout changes).
  useEffect(() => {
    rendererRef.current?.update({
      text,
      fallback: FALLBACK,
      field,
      params,
      layout,
      fontFamily: stencil.style.fontFamily,
    });
  }, [text, field, params, layout]);

  return <canvas ref={canvasRef} aria-label={text} className="block" />;
}
