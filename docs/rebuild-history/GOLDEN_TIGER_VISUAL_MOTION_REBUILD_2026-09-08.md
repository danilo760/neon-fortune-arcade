# Golden Tiger Visual + Motion Rebuild

This pass focuses on the Golden Tiger presentation layer only.

## What changed
- Rebuilt the tiger stage to use a layered mascot rig instead of the older flat stage.
- Added separate body/head/aura/coin/spark layers for stronger character presence.
- Improved cell and symbol presentation with premium lighting, plates, gloss and win glow.
- Kept the existing game math and round flow intact.
- Preserved the Render-compatible Nitro node-server config already in the project.

## What did not change
- RTP / payout math
- RNG
- hold & win logic
- balances / bets
- project runtime stack

## Files touched
- src/components/arcade/golden-tiger/GoldenTigerTigerStage.tsx
- src/components/arcade/golden-tiger/GoldenTigerSymbols.tsx
- src/components/arcade/GoldenTigerReference.css
- GOLDEN_TIGER_VISUAL_MOTION_REBUILD_2026-09-08.md

## Validation performed
- TypeScript transpile parse on touched TS/TSX files
- CSS structural validation
- ZIP integrity validation
