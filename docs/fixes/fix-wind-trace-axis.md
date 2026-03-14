# Fix: Wind Trace Axis Inversion

**Status:** Ready for implementation
**Severity:** High — the trace is drawing incorrect paths and producing false intersections
**Component:** `lib/trace.ts` computation + `TraceSVG.tsx` rendering

---

## Bug

The wind trace's y-axis is inverted. A south wind (which should push the pointer north / upward on screen) is drawing downward, and vice versa. The x-axis has not been independently verified and must be checked as part of this fix.

## Why this happened

There are two coordinate systems in play, and they disagree about what "positive y" means:

- **Cartesian (math/geography):** +y = up = north. How humans think about maps.
- **SVG (screen):** +y = down = south. How browsers render.

The current `computeTracePoint` formula produces values in SVG convention (north wind makes y increase, which SVG renders as downward/south — technically correct). But if the renderer *also* flips y — because someone reasonably assumed "positive y should be up" — the result is a double inversion.

This is the root confusion. A formula that looks wrong ("north wind increases y?") invites a "fix" at the render layer, and now both ends are compensating in opposite directions.

## Principle: Cartesian in, flip once at render

**Store trace points in Cartesian coordinates.** When you query the database or read the code, the values should be intuitive:

- North wind (from 0°) pushes south → y **decreases**
- South wind (from 180°) pushes north → y **increases**
- East wind (from 90°) pushes west → x **decreases**
- West wind (from 270°) pushes east → x **increases**

The SVG renderer applies **one** y-flip at the render boundary (`y_screen = -y_stored`). That is the only place the SVG screen convention matters.

This means `computeTracePoint` should be:

```
x = prevX - windSpeed * sin(rad)     // unchanged
y = prevY - windSpeed * cos(rad)     // sign flipped from current code
```

And the renderer should negate y when building the SVG path, or use a `scale(1, -1)` transform.

**The contract (Cartesian, stored in DB):**

| Wind from | Degrees | Pointer moves | x effect | y effect |
|---|---|---|---|---|
| North | 0° | South | 0 | −speed |
| East | 90° | West | −speed | 0 |
| South | 180° | North | 0 | +speed |
| West | 270° | East | +speed | 0 |

After the fix, add a **convention comment** at the top of `computeTracePoint` and in `TraceSVG` documenting this contract, so future changes don't silently re-break it.

## Data consequences

All existing `TracePoint` and `Intersection` rows were computed with the wrong convention. After fixing the code:

1. Back up any intersection text (writing) if it exists.
2. Run `scripts/reset-trace.ts` to clear all trace points and intersections.
3. Run `scripts/backfill-trace.ts` to recompute from historical snapshots.
4. Visual spot-check: compare the recomputed trace against Berlin wind patterns for the period.

## Testing

**Convention test (unit):** Add a test in `trace.test.ts` that pins the contract table above — south wind (180°) must produce y > prevY, north wind must produce y < prevY, etc. This makes the coordinate convention executable and visible to anyone editing the formula.

**Visual spot-check (manual, post-fix):** After backfill, compare trace drift direction against a Berlin wind rose for the same date range. One-time sanity check.

## Files to touch

- `lib/trace.ts` — fix formula sign, add convention comment
- `app/trace/TraceSVG.tsx` — ensure exactly one y-flip at render, add convention comment
- `lib/trace.test.ts` — add convention-pinning test
- `scripts/reset-trace.ts` + `scripts/backfill-trace.ts` — run post-fix

## Acceptance criteria

- [ ] South wind draws pointer upward on screen; north wind draws downward
- [ ] West wind draws pointer rightward; east wind draws leftward
- [ ] `computeTracePoint` outputs Cartesian coordinates (y-up = north)
- [ ] SVG renderer applies exactly one y-flip
- [ ] Convention comments exist in both `computeTracePoint` and `TraceSVG`
- [ ] All trace data recomputed via reset + backfill
- [ ] Convention test in `trace.test.ts`