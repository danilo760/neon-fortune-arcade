# Golden Tiger Premium Rebuild Final — 2026-09-08

This pass is a presentation rebuild of Golden Tiger. It does not change game math.

## What changed

### Mascot
- Added two original premium mascot pose assets:
  - `src/assets/golden-tiger/tiger-idle.webp`
  - `src/assets/golden-tiger/tiger-win.webp`
- `GoldenTigerTigerStage.tsx` now blends the two poses by state.
- Acting states: idle, watch, tense, reveal, coin, win, full-grid.
- Added breathing, anticipation, reveal recoil, celebration, crown/medallion light and sparks.

### Symbols
- Replaced the old flat inline SVG symbol set with rendered premium WebP art.
- Added eight new symbol assets under `src/assets/golden-tiger/symbols/`.
- Symbol IDs and game math are unchanged.

### Reel window
- Reworked the 3×3 presentation so it reads as a single reel window rather than nine generic UI cards.
- Added per-column reel-landing squash/settle.
- Added reveal hierarchy: winning symbols come forward while non-winning symbols dim.
- Added result-driven anticipation only when the already-determined result contains a win or Hold & Win entry.

### Win presentation
- Strengthened win/full-grid staging around the mascot and reel window.
- Added authored title/number entrance and light rays.
- Existing semantic win tiers and honest partial-return handling are preserved.

### Audio / timing
- Reuses the existing procedural audio mixer.
- Added a short anticipation cue before the third reel only when the already-computed result warrants it.
- Existing reel landing stereo cues, reveal cue and win-tier cues remain intact.

## Files changed
- `src/components/arcade/GoldenTigerReference.tsx`
- `src/components/arcade/GoldenTigerReference.css`
- `src/components/arcade/golden-tiger/GoldenTigerTigerStage.tsx`
- `src/components/arcade/golden-tiger/GoldenTigerSymbols.tsx`
- `src/assets/golden-tiger/tiger-idle.webp`
- `src/assets/golden-tiger/tiger-win.webp`
- `src/assets/golden-tiger/symbols/*.webp`

## Not changed
- RNG
- RTP / payout tables
- Hold & Win math
- balance accounting
- bet values
- Nitro `node-server` Render deployment config

## Validation performed
- TypeScript 5.8.3 transpile parser: all 111 `.ts`/`.tsx` files passed syntax validation.
- Golden Tiger CSS delimiter structure passed.
- Final ZIP integrity test passed.
- Full Vite production build was not claimed here; Render remains the integration build.
