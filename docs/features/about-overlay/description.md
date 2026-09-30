# About overlay

A small info button at the bottom left of the trace page opens a short explanation of the project.

## Look (locked in the prototype)
- **Button**: a small hand-drawn ring, drawn with the same pen as the crossing rings
  (`lib/domain/mark-shape.ts`), around an italic Literata *i*. At rest it is still and grey; on
  hover or while open it darkens and breathes on the marks' period.
- **Overlay**: a white sheet sliding in from the left, mirroring the intersection panel on the right
  (same width fraction, hairline border, 24px padding, `✕` glyph). Full-screen on mobile.
- **Contents**: one Plex Mono meta line with real counts, then two short Literata paragraphs.

Prototype: https://claude.ai/artifact/HyD6wSYMovBmXKDM3jEZ6W (direction 1).

## Tuned values
| | |
|---|---|
| ring centre | 31px from left and bottom |
| ring radius / stroke | 15px / 1px |
| *i* size | 17px |
| hover growth | 1.12 |
| breath depth / period | 0.12 / 7.4s |
| ring pen seed | 7 (fixed shape) |
| sheet width | max(360px, 33%) |
| open/close | 320ms |
| copy size / measure | 15px / 38ch |

## Copy
Meta line, computed from the data: `17 Feb 2026 – now · 4,558 hours · 140 crossings`
(first trace point's date, number of trace points, number of crossings with text).

> Every hour the wind is looked up for wherever I am, and it moves a pen: its direction sets which
> way, its speed sets how far. The pen has not lifted since February.
>
> Where the line crosses itself, two hours of weather meet at one point. Each crossing is circled,
> and a haiku is written from those two readings. Click a circle to read it.
