# Flow-Field Headline — Feature Spec

**Status**: In progress
**Type**: Public UI (app code)

---

## What this is

The `/` header text is rendered as an animated **wind quiver / flow field** instead of plain type —
short direction strokes, dense inside the letterforms and faint outside, flowing through turbulence.
The turbulence is a *synthetic field whose statistics match a real wind reading* (mean flow from
direction + speed, turbulence intensity from the gust factor as `TI = (G−1)/3`, a slow direction
meander from the 24h circular variance). Technical and poetic at once: the title is drawn by the wind.

Prototype (approved): the published concept artifact.

## Decisions

- **Text**: default header = the word **"Trace"** — the wind reading now drives *motion only*, not
  text. When an intersection is hovered/active, show a **compact date** form `D/M/YY × D/M/YY`
  (no leading zeros, 2-digit year), e.g. `4/4/26 × 19/4/26`.
- **Size**: medium top-left (~56px cap height) — larger than the old 24px so arrows read, still a
  corner label so the trace stays the focus.
- **Motion**: always animating; pauses when the tab/section is hidden; a single static frame under
  `prefers-reduced-motion`.
- **Parameterised**: the render "feel" is a `FlowFieldParams` config (same knobs as the prototype's
  tuning panel) with defaults = the tuned values, including the **length-variance ramp** (variance
  intensifies with wind speed → stormy feel). Overridable per instance.

## Data

Server computes a compact `windField = { dirDeg, meanSpeed, gustFactor, TI, meanderDeg }` from the last
24 hourly snapshots and passes it to the client (no rawJson blobs cross the boundary). Wind gusts +
direction live in `rawJson.current` (`wind_gusts_10m`, `wind_direction_10m`).

## Out of scope

- Live tuning panel in production (the engine is param-driven, so it can be re-added dev-only later).
- Showing the numeric wind reading as text (it's motion-only now; a caption is a trivial follow-up).
