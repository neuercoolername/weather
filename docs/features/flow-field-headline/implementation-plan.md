# Flow-Field Headline — Implementation Plan

## Engine — `lib/flow-field.ts` (pure, parameterised)

```
type FlowFieldParams = {
  churn; eddySize; letterJitter; advectionMax;
  pulseDepth; pulsePeriodSec; lengthVariance; lengthRampFactor; anisotropy;
};
DEFAULT_FLOW_FIELD_PARAMS = { churn:1.70, eddySize:22, letterJitter:0.78,
  advectionMax:230, pulseDepth:0.47, pulsePeriodSec:7.4, lengthVariance:0.32,
  lengthRampFactor:3.0, anisotropy:0.70 };
```

- `makeNoise(seed)` → seeded improved-Perlin 3D; `fbm(x,y,z)` 3 octaves, lacunarity 2, gain 0.8.
- `makeFieldState(t, field, params, W, H)` → per-frame `{ Uhx,Uhy, freq, evolZ, sweepX,sweepY, pulse, speedNorm }`
  (mean-flow unit vector from `dirDeg` + meander; advection sweep; gust pulse; `speedNorm` from meanSpeed).
- `curl(px,py,S)` → divergence-free fluctuation with anisotropy along `U`.
- `arrowAt(px,py,cov,S,params)` → `{ hx,hy, len, alpha }` — Reynolds `u=U+u'`, in-letter jitter clamp
  via `letterJitter`, length ramp `effVar = lengthVariance·lerp(1,lengthRampFactor,smoothstep(0.2,1,speedNorm))`.
- Helpers: `clamp,lerp,smoothstep`. No DOM — canvas drawing stays in the component.

## Data — `lib/wind-field.ts`

`WindField = { dirDeg, meanSpeed, gustFactor, TI, meanderDeg }`.
`computeWindField(series: {spd,gust,dir}[]) : WindField | null` — null on empty; else mean speed,
gustFactor=mean(gust)/mean(spd), TI=(clamp(G,1.1,3)−1)/3, circular mean dir, circular-variance→meanderDeg.

## Component — `app/trace/FlowFieldHeadline.tsx` ("use client")

Props `{ text, field: WindField|null, params?: Partial<FlowFieldParams> }`. Canvas sized to measured
text at ~56px cap height. Offscreen mask (Archivo Black) → supersampled `coverage()`. rAF loop draws
tapered strokes per grid cell using `arrowAt`. Cleanup: `cancelAnimationFrame`, `ResizeObserver`
disconnect, `visibilitychange` pause. `prefers-reduced-motion` → one static frame. Ink = `--foreground`.
`field=null` → calm default `WindField`.

## Wiring

- `app/layout.tsx`: `Archivo_Black({weight:"400",subsets:["latin"],variable:"--font-stencil"})`; add var to `<body>`.
- `app/page.tsx`: last-24 `findMany`, extract `{spd,gust,dir}` from `rawJson.current`, `computeWindField` → `windField` prop.
- `app/trace/TraceSVG.tsx`: `latestWind` → `windField` prop; forward to `TraceHeader`.
- `app/trace/TraceHeader.tsx`: `text = displayIntersection ? compact×compact : "Trace"`; `<FlowFieldHeadline text field={windField} />`.

## Verify

`npm test` (engine + wind-field), `npm run build`, browser MCP on localhost:3000 (see checklist).
