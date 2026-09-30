# About overlay — checklist

- [x] `seededRandom` exported from `lib/domain/mark-shape.ts`; test uses it + determinism test
- [x] `lib/domain/about.ts`: `DEFAULT_ABOUT_PARAMS` + `aboutMeta` + tests
- [x] `page.tsx` computes the meta line and passes it to `TraceSVG`
- [x] `AboutButton.tsx`: fixed-seed ring, *i*, CSS breathing on hover/open, reduced-motion off
- [x] `AboutPanel.tsx`: left sheet, slide transition, meta + copy, ✕, Esc, focus handling, mobile full-screen
- [x] `TraceSVG` wiring: `aboutOpen`, panels exclude each other, background click closes
- [x] `next.config.ts`: dev indicator bottom-right
- [x] `npm test` and `npm run build` green
- [x] Verify in the running app: closed/open at desktop and 390px, breathing measured across frames, Esc, crossing click closes About, no hydration warnings
- [x] Update `docs/state.md`
