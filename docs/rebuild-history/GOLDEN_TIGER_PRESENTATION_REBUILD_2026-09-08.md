# Golden Tiger Presentation Rebuild — 2026-09-08

This pass follows the second recorded Render comparison and deliberately focuses on the largest remaining presentation gap: Golden Tiger.

## What changed

### Character rig
- Replaced the old mostly single-piece mascot SVG with an original multi-part SVG rig.
- Separate groups now exist for body, head, arms, tail, pupils, medallion, coin prop and supporting light layers.
- Added state-specific motion for idle breathing, head motion, tail follow-through, reel watching, reveal reaction, coin reaction, tense state, win celebration and full-grid celebration.
- Added spotlight and floor-shadow layers so the mascot reads as part of the cabinet instead of a sticker above the reels.

### Reel presentation
- Added a `reveal` phase between the final reel stop and feature/win resolution.
- Added a `landingColumn` presentation state so each of the three reel stops gets a discrete physical settle.
- Added stereo reel-land cues positioned left / centre / right.
- Added a distinct reveal cue for net-positive base results.

### Win hierarchy
- Added persistent `winTier` presentation state using the existing Golden Tiger tier function.
- A payout that does not exceed the stake no longer enters the celebration phase; it is presented as a return.
- Small/nice wins stay local to the cabinet in a ribbon.
- Big/mega wins take over the screen.
- Full-grid remains the highest visual event.
- This changes presentation only; no payout, RNG or wallet math was changed.

### Audio
- Added original procedural `tigerReelLand`, `tigerReveal` and `tigerWinAccent` cues.
- Reel-land cues use bounded stereo pan.
- Win accents remain semantically separated from partial returns.
- Existing ambience, ducking, compressor and reverb architecture is preserved.

## Research principles applied
- Anticipation, staging, follow-through and squash/stretch as motion-perception tools.
- Audiovisual thematic cohesion: character, reel, sound and FX should describe one event rather than four independent events.
- Dynamic range: ambience should create continuity without making every event loud.
- Multisensory congruence: reel landing sound and visual impact are synchronized and spatially aligned.
- Reward hierarchy remains tied to actual economic outcome instead of celebrating returns below stake.

## Validation performed in this environment
- `sound.ts` + `audioEventGate.ts` compile in isolation with TypeScript 5.8.3 and DOM/ES2022 libs.
- Modified TSX files were parsed by TypeScript with no syntax-class diagnostics; unresolved-module diagnostics are expected because the archive does not include `node_modules`.
- Golden Tiger CSS has balanced braces and parentheses.
- No full Vite build is claimed here. Render remains the integration build environment.

## Files changed
- `src/components/arcade/GoldenTigerReference.tsx`
- `src/components/arcade/golden-tiger/GoldenTigerTigerStage.tsx`
- `src/components/arcade/GoldenTigerReference.css`
- `src/lib/arcade/sound.ts`
