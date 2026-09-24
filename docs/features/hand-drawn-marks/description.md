# Hand-drawn crossing marks

The crossing mark was a perfect circle, which read as mechanical next to the rambling wind trace.
Replace it with a ring that looks drawn by hand.

- Each crossing gets its own random ring, drawn fresh on every page load (not seeded from data).
- Rings mix four pen styles by weight: **overshoot** (pen runs past its start), **gap** (pen lifts
  early), **closed** (ends meet, only the outline wobbles), **multi-pass** (a loose second turn).
- Open strokes carry pen behaviour: a lead-in onto the circle, a flick off it, a slow wander so
  passes drift apart and together, and a sliding centre so passes are not concentric.
- Everything else about the mark is unchanged: size, stroke weight, open-stroke thickening, hover and
  open growth, breathing (the fixed shape scales; the wobble does not animate), uniform stroke.
- A group ring uses the shape of its key (lowest-id) member, so it keeps its shape while zooming until
  that member splits off.
- Tuned in the prototype artifact https://claude.ai/artifact/Y7WLaEwnFym4Q5a4vH96vA; its defaults
  are the shipped defaults.
