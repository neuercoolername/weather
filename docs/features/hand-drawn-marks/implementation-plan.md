# Hand-drawn crossing marks — implementation plan

1. **`lib/domain/mark-shape.ts`** (pure): `RingShapeParams` + `DEFAULT_RING_SHAPE_PARAMS` (the
   prototype's config), `pickRingStyle`, `ringPoints`, `ringPath` and `handDrawnRingPath(rand, params)`,
   which returns a unit-radius SVG path around (0,0). The RNG is injected so tests can seed it.
2. **`TraceMarkParams`** gains `ringShape: RingShapeParams`, defaulting to `DEFAULT_RING_SHAPE_PARAMS`.
3. **`app/(trace)/ring-shapes.ts`** (client): a per-page-load cache, crossing id → path, drawn with
   `Math.random`. A group asks for its `groupKey` member's shape.
4. **Hydration**: the shape is random, so the server and the first client render draw a plain unit
   circle; after mount (`useSyncExternalStore` client flag) the rings switch to their hand-drawn paths.
5. **`IntersectionDot`**: `<g translate(sx,sy)>` wrapping the hit circle and a `<path>` with
   `transform="scale(radius)"` and `vector-effect="non-scaling-stroke"`, so the stroke stays in screen px.
6. **`mark-breathing.ts`**: writes `transform="scale(r)"` instead of `r`; `breathingRadius` is unchanged.
7. Tests in `lib/domain/mark-shape.test.ts`; update `docs/state.md`.
