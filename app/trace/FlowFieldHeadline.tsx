"use client";

import { useEffect, useRef } from "react";
import { Archivo_Black } from "next/font/google";
import type { WindField } from "@/lib/wind-field";
import type { FlowFieldParams } from "@/lib/flow-field";
import {
  createFlowFieldRenderer,
  type FlowFieldRenderer,
  type FlowFieldRendererOpts,
} from "./flowFieldRenderer";

// Heavy stencil face for the letterform mask.
const stencil = Archivo_Black({ weight: "400", subsets: ["latin"], display: "swap" });

export default function FlowFieldHeadline({
  text,
  field,
  params,
}: {
  text: string;
  field: WindField | null;
  params?: Partial<FlowFieldParams>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<FlowFieldRenderer | null>(null);

  // Capture the mount-time options once (lazy ref init — no writes during later renders).
  const initialOptsRef = useRef<FlowFieldRendererOpts | null>(null);
  if (initialOptsRef.current === null) {
    initialOptsRef.current = { text, field, params, fontFamily: stencil.style.fontFamily };
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

  // Sync prop changes into the renderer (cheap; rebuilds the mask only when text changes).
  useEffect(() => {
    rendererRef.current?.update({ text, field, params, fontFamily: stencil.style.fontFamily });
  }, [text, field, params]);

  return <canvas ref={canvasRef} aria-label={text} className="block" />;
}
