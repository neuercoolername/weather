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
import {
  DEFAULT_HEADLINE_LAYOUT,
  isCompactHeadline,
  type HeadlineLayoutParams,
} from "@/lib/domain/headline-layout";

export interface FlowFieldRendererOpts {
  text: string;
  /** shown instead of `text` on a compact device (phone, tablet) */
  fallback: string;
  field: WindField | null;
  params?: Partial<FlowFieldParams>;
  layout?: Partial<HeadlineLayoutParams>;
  /** stencil font family for the letterform mask (from next/font, owned by the component) */
  fontFamily: string;
}

export interface FlowFieldRenderer {
  update(opts: FlowFieldRendererOpts): void;
  destroy(): void;
}

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

/**
 * Draws into `canvas`, sized against the width of its parent element, which should carry no
 * horizontal padding: the side margin is `layout.gutterPx`.
 */
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
  let fallback = initial.fallback;
  let fontFamily = initial.fontFamily;
  let params: FlowFieldParams = { ...DEFAULT_FLOW_FIELD_PARAMS, ...initial.params };
  let layoutParams: HeadlineLayoutParams = { ...DEFAULT_HEADLINE_LAYOUT, ...initial.layout };
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

  function containerWidth(): number {
    return canvas.parentElement?.clientWidth || window.innerWidth || 800;
  }

  // One fixed size for every title; the text takes its natural width. Text wider than the
  // container runs to its edge and fades out there. Only the compact word may shrink, and only
  // in a container too narrow for it.
  function layout() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const pad = 6;
    const { fontPx, gutterPx: left, fadePx } = layoutParams;
    const cw = containerWidth();
    const avail = Math.max(1, cw - left * 2 - pad * 2);
    const noHover = window.matchMedia("(hover: none)").matches;
    const compact = isCompactHeadline(cw, noHover, layoutParams);
    const shown = compact ? fallback : text;

    let size = fontPx;
    if (compact) {
      for (; size > 14; size -= 2) {
        mctx.font = `${size}px ${fontFamily}`;
        if (mctx.measureText(shown).width <= avail) break;
      }
    }
    const fontStr = `${size}px ${fontFamily}`;
    mctx.font = fontStr;
    const textW = Math.ceil(mctx.measureText(shown).width);
    const overflows = textW > avail;
    W = Math.max(1, overflows ? cw : left + textW + pad * 2);
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
    mctx.fillText(shown, left + pad, size * 0.98);

    if (overflows) {
      // One fill over the whole mask: the gradient pads opaque before its start, so only
      // the last `fadePx` fade.
      const fade = mctx.createLinearGradient(W - fadePx, 0, W, 0);
      fade.addColorStop(0, "rgba(255,255,255,1)");
      fade.addColorStop(1, "rgba(255,255,255,0)");
      mctx.globalCompositeOperation = "destination-in";
      mctx.fillStyle = fade;
      mctx.fillRect(0, 0, W, H);
      mctx.globalCompositeOperation = "source-over";
    }

    maskData = mctx.getImageData(0, 0, W, H).data;
    ink = readInk();
  }

  // Re-lay on container resize, at most once a frame. The observer's first call arrives
  // before start() has run, so nothing is laid out until the font is in.
  let relayoutRaf = 0;
  const resizeObserver = new ResizeObserver(() => {
    if (!maskData || relayoutRaf) return;
    relayoutRaf = requestAnimationFrame(() => {
      relayoutRaf = 0;
      if (destroyed) return;
      layout();
      if (reduce) drawFrame(0);
    });
  });
  if (canvas.parentElement) resizeObserver.observe(canvas.parentElement);

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
      .load(`${layoutParams.fontPx}px ${fontFamily}`)
      .catch(() => {})
      .finally(start);
  } else {
    start();
  }

  return {
    update(next) {
      const nextLayout = { ...DEFAULT_HEADLINE_LAYOUT, ...next.layout };
      const layoutChanged =
        next.text !== text ||
        next.fallback !== fallback ||
        (Object.keys(nextLayout) as (keyof HeadlineLayoutParams)[]).some(
          (k) => nextLayout[k] !== layoutParams[k]
        );
      text = next.text;
      fallback = next.fallback;
      layoutParams = nextLayout;
      fontFamily = next.fontFamily;
      params = { ...DEFAULT_FLOW_FIELD_PARAMS, ...next.params };
      wf = next.field ?? CALM_WIND_FIELD;
      turb0 = turbulenceAmplitude(wf.TI);
      // Not laid out yet → start() will pick up the latest values.
      if (!maskData) return;
      if (layoutChanged) layout(); // remeasure + rebuild mask + resize canvas
      // Animating: the running loop reflects field/param changes automatically.
      // Static (reduced-motion): repaint one frame to reflect the change.
      if (reduce) drawFrame(0);
    },
    destroy() {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      if (relayoutRaf) cancelAnimationFrame(relayoutRaf);
      resizeObserver.disconnect();
    },
  };
}
