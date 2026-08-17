// Imperative canvas controller for the flow-field headline — the "external system"
// that a React effect connects to. Framework-agnostic: no React, no next/font
// (the stencil family is passed in). Create it, push prop changes via update(),
// tear it down via destroy(). Rendering math lives in the pure lib/flow-field.

import type { WindField } from "@/lib/domain/wind-field";
import {
  makeNoise,
  makeFbm,
  makeFieldState,
  advectionSpeed,
  arrowAt,
  turbulenceAmplitude,
  clamp,
  DEFAULT_FLOW_FIELD_PARAMS,
  CALM_WIND_FIELD,
  type FlowFieldParams,
} from "@/lib/domain/flow-field";

export interface FlowFieldRendererOpts {
  text: string;
  field: WindField | null;
  params?: Partial<FlowFieldParams>;
  /** stencil font family for the letterform mask (from next/font, owned by the component) */
  fontFamily: string;
}

export interface FlowFieldRenderer {
  update(opts: FlowFieldRendererOpts): void;
  destroy(): void;
}

const FONT_PX = 64; // medium: ~56px cap height
const DENS = 6; // grid spacing (px)
const WEIGHT = 1.3; // stroke width

function readInk(): string {
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue("--foreground")
    .trim();
  const m = /^#?([0-9a-f]{6})$/i.exec(v);
  if (m) {
    const n = parseInt(m[1], 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  }
  return "23,23,23";
}

export function createFlowFieldRenderer(
  canvas: HTMLCanvasElement,
  initial: FlowFieldRendererOpts
): FlowFieldRenderer {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { update() {}, destroy() {} };

  const noise = makeNoise(20260803);
  const fbm = makeFbm(noise);
  const slow = makeNoise(7717);

  // offscreen letterform mask (CSS-pixel resolution)
  const mask = document.createElement("canvas");
  const mctx = mask.getContext("2d", { willReadFrequently: true })!;

  // mutable state, swapped by update()
  let text = initial.text;
  let fontFamily = initial.fontFamily;
  let params: FlowFieldParams = { ...DEFAULT_FLOW_FIELD_PARAMS, ...initial.params };
  let wf: WindField = initial.field ?? CALM_WIND_FIELD;
  let turb0 = turbulenceAmplitude(wf.TI);

  let maskData: Uint8ClampedArray | null = null;
  let W = 0;
  let H = 0;
  let dpr = 1;
  let ink = readInk();

  let tSec = 0;
  let advDist = 0;
  let last = performance.now();
  let raf = 0;
  let destroyed = false;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function layout() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const pad = 6;
    const maxW = Math.min((window.innerWidth || 800) - 48, 680);
    let size = FONT_PX;
    for (; size > 14; size -= 2) {
      mctx.font = `${size}px ${fontFamily}`;
      if (mctx.measureText(text).width <= maxW - pad * 2) break;
    }
    const fontStr = `${size}px ${fontFamily}`;
    mctx.font = fontStr;
    const textW = Math.ceil(mctx.measureText(text).width);
    W = Math.max(1, textW + pad * 2);
    H = Math.round(size * 1.34);

    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;

    mask.width = W;
    mask.height = H;
    mctx.clearRect(0, 0, W, H);
    mctx.fillStyle = "#fff";
    mctx.textAlign = "left";
    mctx.textBaseline = "alphabetic";
    mctx.font = fontStr;
    mctx.fillText(text, pad, size * 0.98);
    maskData = mctx.getImageData(0, 0, W, H).data;
    ink = readInk();
  }

  // supersampled letter coverage 0..1
  function coverage(x: number, y: number): number {
    if (!maskData) return 0;
    let s = 0;
    for (let oy = -1; oy <= 1; oy++)
      for (let ox = -1; ox <= 1; ox++) {
        const px = (x + ox * 2) | 0;
        const py = (y + oy * 2) | 0;
        if (px < 0 || py < 0 || px >= W || py >= H) continue;
        s += maskData[(py * W + px) * 4 + 3];
      }
    return s / (9 * 255);
  }

  function drawFrame(dt: number) {
    if (!maskData) return;
    const S = makeFieldState(wf, params, tSec, advDist, slow);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx!.clearRect(0, 0, W, H);
    ctx!.lineJoin = "round";
    for (let gy = DENS * 0.5; gy < H; gy += DENS)
      for (let gx = DENS * 0.5; gx < W; gx += DENS) {
        const cov = coverage(gx, gy);
        const a = arrowAt(gx, gy, cov, turb0, S, params, fbm);
        if (a.alpha < 0.05) continue;
        const len = clamp(a.lenScale * DENS, 1, DENS * 1.4);
        const hl = len * 0.5;
        const wt = WEIGHT * (0.55 + 0.75 * cov);
        const wh = wt * 0.18;
        const tx = gx - a.hx * hl,
          ty = gy - a.hy * hl,
          ex = gx + a.hx * hl,
          ey = gy + a.hy * hl,
          nx = -a.hy,
          ny = a.hx;
        ctx!.fillStyle = `rgba(${ink},${a.alpha})`;
        ctx!.beginPath();
        ctx!.moveTo(tx + nx * wt, ty + ny * wt);
        ctx!.lineTo(ex + nx * wh, ey + ny * wh);
        ctx!.lineTo(ex - nx * wh, ey - ny * wh);
        ctx!.lineTo(tx - nx * wt, ty - ny * wt);
        ctx!.closePath();
        ctx!.fill();
      }
    tSec += dt;
    advDist += advectionSpeed(params, S.speedNorm) * dt;
  }

  function loop(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!document.hidden) drawFrame(dt);
    raf = requestAnimationFrame(loop);
  }

  function start() {
    if (destroyed) return;
    layout();
    if (reduce) {
      drawFrame(0); // single static frame
      return;
    }
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }

  // wait for the stencil font before building the mask, then start
  if (document.fonts && document.fonts.load) {
    document.fonts
      .load(`${FONT_PX}px ${fontFamily}`)
      .catch(() => {})
      .finally(start);
  } else {
    start();
  }

  return {
    update(next) {
      const textChanged = next.text !== text;
      text = next.text;
      fontFamily = next.fontFamily;
      params = { ...DEFAULT_FLOW_FIELD_PARAMS, ...next.params };
      wf = next.field ?? CALM_WIND_FIELD;
      turb0 = turbulenceAmplitude(wf.TI);
      // Not laid out yet → start() will pick up the latest values.
      if (!maskData) return;
      if (textChanged) layout(); // remeasure + rebuild mask + resize canvas
      // Animating: the running loop reflects field/param changes automatically.
      // Static (reduced-motion): repaint one frame to reflect the change.
      if (reduce) drawFrame(0);
    },
    destroy() {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
    },
  };
}
